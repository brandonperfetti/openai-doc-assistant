import { getElementsBetween } from '@/helper/elements.between'
import { makeId } from '@/helper/make.id'
import { openai } from '@/helper/open.ai'
import { prisma } from '@/helper/prisma.client'
import { client } from '@/trigger'
import { eventTrigger } from '@trigger.dev/sdk'
import fs from 'fs'
import { JSDOM } from 'jsdom'
import { chunk } from 'lodash'
import { object, string } from 'zod'

import { createReadStream, readFile, stat, writeFile } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { promisify } from 'util'

const readFileAsync = promisify(readFile)
const writeFileAsync = promisify(writeFile)
const statAsync = promisify(stat)

async function fetchSitemapUrl(baseUrl: string) {
	// Common sitemap URLs
	const commonUrls = [`${baseUrl}/sitemap.xml`, `${baseUrl}/sitemap_index.xml`]
	for (const url of commonUrls) {
		const response = await fetch(url)
		if (response.ok) return url // Sitemap found
	}

	// Attempt to fetch from robots.txt
	const robotsResponse = await fetch(`${baseUrl}/robots.txt`)
	if (robotsResponse.ok) {
		const robotsText = await robotsResponse.text()
		const match = robotsText.match(/^Sitemap:\s*(\S+)$/m)
		if (match) return match[1] // Sitemap URL found
	}

	throw new Error('Sitemap not found')
}

// Define the batch size for pagination
const batchSize = 100 // Adjust based on your needs and observations

// Define an async function to paginate through docs
async function fetchAndProcessDataInBatches(
	identifier: string,
	tempFilePath: fs.PathLike,
) {
	let lastId = 0 // Assuming 'id' is an auto-increment field and you have it
	let hasMore = true

	// Open a stream to write data to the file
	const stream = fs.createWriteStream(tempFilePath, { flags: 'a' })

	while (hasMore) {
		const rows = await prisma.docs.findMany({
			where: {
				identifier,
				id: {
					gt: lastId,
				},
			},
			take: batchSize,
			orderBy: {
				id: 'asc',
			},
			select: {
				id: true, // Make sure to select the 'id'
				content: true,
			},
		})

		// Process (write) each row's content to the file
		rows.forEach(row => {
			stream.write(row.content + '\n\n')
			lastId = row.id // Update lastId with the last row's id in this batch
		})

		// Check if there are more rows to process
		hasMore = rows.length === batchSize
	}

	// Close the stream
	stream.end()
}

client.defineJob({
	// This is the unique identifier for your Job, it must be unique across all Jobs in your project.
	id: 'process-documentation',
	name: 'Process Documentation',
	version: '0.0.1',
	// This is triggered by an event using eventTrigger. You can also trigger Jobs with webhooks, on schedules, and more: https://trigger.dev/docs/documentation/concepts/triggers/introduction
	trigger: eventTrigger({
		name: 'process.documentation.event',
		schema: object({
			url: string(),
		}),
	}),
	integrations: {
		openai,
	},
	run: async (payload, io, ctx) => {
		// The first task to get the sitemap url from the website
		const getSiteMap = await fetchSitemapUrl(payload.url)

		// We parse the sitemap, instead of using some XML parser, we just use regex to get the urls and we return it in chunks of 25
		const { identifier, list } = await io.runTask(
			'load-and-parse-sitemap',
			async () => {
				const urls =
					/(http|ftp|https):\/\/([\w_-]+(?:(?:\.[\w_-]+)+))([\w.,@?^=%&:\/~+#-]*[\w@?^=%&\/~+#-])/g
				const identifier = makeId(5)
				const data = await (await fetch(getSiteMap)).text()
				// console.log(data)
				return {
					identifier,
					list: chunk(
						// @ts-ignore
						([...new Set(data.match(urls))] as string[])
							.filter(f => f.includes(payload.url))
							.map(p => ({ identifier, url: p })),
						25,
					),
				}
			},
		)

		// We go into each page and grab the content, we do this in batches of 25 and save it to the DB
		let i = 0
		for (const item of list) {
			await processContent.batchInvokeAndWaitForCompletion(
				'process-list-' + i,
				item.map(
					payload => ({
						payload,
					}),
					86_400,
				),
			)
			i++
		}

		// We get the data that we saved in batches from the DB
		const data = await io.runTask('get-extracted-data', async () => {
			return (
				await prisma.docs.findMany({
					where: {
						identifier,
					},
					select: {
						content: true,
					},
				})
			)
				.map(d => d.content)
				.join('\n\n')
		})

		// Create a temporary file path
		const tempFilePath = join(tmpdir(), `documentation-${identifier}.md`)

		// console.log(`Data to be written: ${data.substring(0, 500)}`) // Log a portion of the data to avoid overwhelming the console

		// Instead of fetching all data and writing it once, use the new function
		await fetchAndProcessDataInBatches(identifier, tempFilePath)

		// console.log(`Markdown file created at: ${tempFilePath}`)

		// Read back the first few lines to log them for verification
		const fileContent = await readFileAsync(tempFilePath, 'utf8')
		const previewLines = fileContent.split('\n').slice(0, 10).join('\n') // Adjust the number of lines as needed

		// console.log(`Preview of Markdown file content:\n${previewLines}`)

		// Get file stats
		const stats = await statAsync(tempFilePath)
		// console.log(`File size: ${stats.size} bytes`)

		// Create a stream for the file
		const fileStream = createReadStream(tempFilePath)
		// console.log(`Stream created for file upload: ${tempFilePath}`)

		// We upload the data to OpenAI with all the content
		const file = await io.openai.files.createAndWaitForProcessing(
			'upload-file',
			{
				purpose: 'assistants',
				file: createReadStream(tempFilePath), // Changed to read from the file stream
			},
		)

		// We create a new assistant or update the old one with the new file
		const assistant = await io.openai.runTask(
			'create-or-update-assistant',
			async openai => {
				const currentAssistant = await prisma.assistant.findFirst({
					where: {
						url: payload.url,
					},
				})
				if (currentAssistant) {
					return openai.beta.assistants.update(currentAssistant.aId, {
						file_ids: [file.id],
					})
				}
				return openai.beta.assistants.create({
					name: identifier,
					description: 'Documentation',
					instructions:
						'You are a documentation assistant, you have been loaded with documentation from ' +
						payload.url +
						', return everything in an MD format.',
					model: 'gpt-4-1106-preview',
					tools: [{ type: 'code_interpreter' }, { type: 'retrieval' }],
					file_ids: [file.id],
				})
			},
		)

		// We update our internal database with the assistant
		await io.runTask('save-assistant', async () => {
			await prisma.assistant.upsert({
				where: {
					url: payload.url,
				},
				update: {
					aId: assistant.id,
				},
				create: {
					aId: assistant.id,
					url: payload.url,
				},
			})
		})
	},
})

// This is the Job that will grab the content from the website
const processContent = client.defineJob({
	// This is the unique identifier for your Job, it must be unique across all Jobs in your project.
	id: 'process-content',
	name: 'Process Content',
	version: '0.0.1',
	// This is triggered by an event using eventTrigger. You can also trigger Jobs with webhooks, on schedules, and more: https://trigger.dev/docs/documentation/concepts/triggers/introduction
	trigger: eventTrigger({
		name: 'process.content.event',
		schema: object({
			url: string(),
			identifier: string(),
		}),
	}),
	run: async (payload, io, ctx) => {
		// console.log(`Processing content for URL: ${payload.url}`) // Log the URL being processed
		return io.runTask('grab-content', async () => {
			try {
				// We first grab a raw html of the content from the website
				const data = await (await fetch(payload.url)).text()
				// console.log(`Fetched content for URL: ${payload.url}`) // Success log for fetching

				// We load it with JSDOM so we can manipulate it
				const dom = new JSDOM(data)

				// We remove all the scripts and styles from the page
				dom.window.document
					.querySelectorAll('script, style')
					.forEach(el => el.remove())

				// We grab all the titles from the page
				const content = Array.from(
					dom.window.document.querySelectorAll('h1, h2, h3, h4, h5, h6'),
				)

				// We grab the last element so we can get the content between the last element and the next element
				const lastElement =
					content[content.length - 1]?.parentElement?.nextElementSibling!
				const elements = []

				// We loop through all the elements and grab the content between each title
				for (let i = 0; i < content.length; i++) {
					const element = content[i]
					const nextElement = content?.[i + 1] || lastElement
					const elementsBetween = getElementsBetween(element, nextElement)
					elements.push({
						title: element.textContent,
						content: elementsBetween.map(el => el.textContent).join('\n'),
					})
				}

				// We create a raw text format of all the content
				const page = `
            ----------------------------------
            url: ${payload.url}\n
            ${elements.map(el => `${el.title}\n${el.content}`).join('\n')}
            ----------------------------------
            `

				// console.log(`Processed content for URL: ${payload.url}`) // Success log for processing

				// We save it to our database
				await prisma.docs.upsert({
					where: {
						url: payload.url,
					},
					update: {
						content: page,
						identifier: payload.identifier,
					},
					create: {
						url: payload.url,
						content: page,
						identifier: payload.identifier,
					},
				})
				// console.log(`Saved content to database for URL: ${payload.url}`) // Success log for database operation
			} catch (e) {
				console.error(`Error processing content for URL: ${payload.url}`, e) // Error logging
			}
		})
	},
})
