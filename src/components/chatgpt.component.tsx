'use client'
import { ExtendedAssistant } from '@/components/main'
import { useEventRunDetails } from '@trigger.dev/react'
import { FC, useCallback, useEffect, useRef, useState } from 'react'
import Markdown from 'react-markdown'

interface Messages {
	message?: string
	eventId?: string
}

export const MessageComponent: FC<{
	eventId: string
	onFinish: (threadId: string) => void
}> = props => {
	const { eventId } = props
	const { data, error } = useEventRunDetails(eventId)

	useEffect(() => {
		if (!data || error) {
			return
		}

		if (data.status === 'SUCCESS') {
			props.onFinish(data.output.threadId)
		}
	}, [data, error, props])

	if (!data || error || data.status !== 'SUCCESS') {
		return (
			<div className="flex justify-end items-center px-2 py-1">
				<p>Reviewing Documentation</p>
				<div className="animate-spin rounded-full h-3 w-3 border-t-2 border-b-2 border-blue-500 ml-2" />
			</div>
		)
	}

	return <Markdown>{`**[Assistant]** ${data.output.content}`}</Markdown>
}

export const ChatgptComponent = ({ list }: { list: ExtendedAssistant[] }) => {
	const url = useRef<HTMLSelectElement>(null)
	const [message, setMessage] = useState('')
	const [messagesList, setMessagesList] = useState([] as Messages[])
	const [threadId, setThreadId] = useState<string>('' as string)
	const messagesEndRef = useRef<HTMLDivElement>(null) // Ref for the messages container

	const scrollToBottom = () => {
		messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
	}

	useEffect(() => {
		scrollToBottom()
	}, [messagesList])

	const submitForm = useCallback(
		async (e: any) => {
			e.preventDefault()
			setMessagesList(messages => [
				...messages,
				{ message: `**[ME]** ${message}` },
			])
			setMessage('')

			const messageResponse = await (
				await fetch('/api/message', {
					method: 'POST',
					body: JSON.stringify({ message, id: url.current?.value, threadId }),
				})
			).json()

			if (!threadId) {
				setThreadId(messageResponse.threadId)
			}

			setMessagesList(messages => [
				...messages,
				{ eventId: messageResponse.eventId },
			])
		},
		[message, url, threadId],
	)

	const handleDocChange = useCallback(() => {
		setMessage('')
		setMessagesList([])
		setThreadId('')
	}, [])

	return (
		<div className="border border-black/50 rounded-2xl flex flex-col max-h-[80vh] overflow-auto">
			<div className="border-b border-b-black/50 h-[60px] gap-3 px-3 flex items-center">
				<div className="flex mx-auto my-4">
					<div className="pr-4 py-2">Docs:</div>
					<div>
						<select
							ref={url}
							className="border border-black/20 rounded-xl p-2"
							onChange={handleDocChange}
						>
							{list
								.filter(f => !f.pending)
								.map(val => (
									<option key={val.id} value={val.id}>
										{val.url}
									</option>
								))}
						</select>
					</div>
				</div>
			</div>
			<div className="flex-1 flex flex-col gap-3 py-3 w-full min-h-[500px] max-h-[1000px] overflow-y-auto overflow-x-hidden messages-list">
				{messagesList.map((val, index) => (
					<div
						key={index}
						className={`flex border-b border-b-black/20 pb-3 px-3`}
					>
						<div className="w-full">
							{val.message ? (
								<Markdown>{val.message}</Markdown>
							) : (
								<MessageComponent
									eventId={val.eventId!}
									onFinish={setThreadId}
								/>
							)}
						</div>
					</div>
				))}
				<div ref={messagesEndRef} /> {/* Invisible element at the bottom */}
			</div>
			<form onSubmit={submitForm}>
				<div className="border-t border-t-black/50 gap-3 p-4 flex items-center">
					<div className="flex-1">
						<input
							value={message}
							onChange={e => setMessage(e.target.value)}
							className="read-only:opacity-20 outline-none border border-black/20 rounded-xl p-2 w-full"
							placeholder="Type your query here"
						/>
					</div>
					<div>
						<button
							className="border border-black/20 rounded-xl p-2 disabled:opacity-20"
							disabled={message.length < 3}
						>
							Send
						</button>
					</div>
				</div>
			</form>
		</div>
	)
}
