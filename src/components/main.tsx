'use client'

import { AssistantList } from '@/components/assistant.list'
import { ChatgptComponent } from '@/components/chatgpt.component'
import { Assistant } from '@prisma/client'
import { TriggerProvider } from '@trigger.dev/react'
import { useCallback, useState } from 'react'
import { FieldValues, SubmitHandler, useForm } from 'react-hook-form'

export interface ExtendedAssistant extends Assistant {
	pending?: boolean
	eventId?: string
}
export default function Main({ list }: { list: ExtendedAssistant[] }) {
	const [assistantState, setAssistantState] = useState(list)
	const { register, handleSubmit } = useForm()

	const submit: SubmitHandler<FieldValues> = useCallback(
		async data => {
			const assistantResponse = await (
				await fetch('/api/assistant', {
					body: JSON.stringify({ url: data.url }),
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
				})
			).json()

			setAssistantState([
				...assistantState,
				{ ...assistantResponse, url: data.url, pending: true },
			])
		},
		[assistantState],
	)

	const changeStatus = useCallback(
		(val: ExtendedAssistant) => async () => {
			const assistantResponse = await (
				await fetch(`/api/assistant?url=${val.url}`, {
					method: 'GET',
					headers: {
						'Content-Type': 'application/json',
					},
				})
			).json()
			setAssistantState([
				...assistantState.filter(v => v.id),
				assistantResponse,
			])
		},
		[assistantState],
	)

	return (
		<TriggerProvider
			publicApiKey={process.env.NEXT_PUBLIC_TRIGGER_PUBLIC_API_KEY!}
		>
			<div className="w-full max-w-2xl mx-auto p-6 flex flex-col gap-2">
				<form
					className="flex items-center space-x-4"
					onSubmit={handleSubmit(submit)}
				>
					<input
						className="flex-grow p-3 border border-black/20 rounded-xl"
						placeholder="Add documentation link"
						type="text"
						{...register('url', { required: 'true' })}
					/>
					<button
						className="flex-shrink p-3 border border-black/20 rounded-xl"
						type="submit"
					>
						Add
					</button>
				</form>
				<div className="divide-y-2 divide-gray-300 flex gap-2 flex-wrap">
					{assistantState.map(val => (
						<AssistantList
							key={val.url}
							val={val}
							onFinish={changeStatus(val)}
						/>
					))}
				</div>
				{assistantState.filter(f => !f.pending) && (
					<ChatgptComponent list={assistantState} />
				)}
			</div>
		</TriggerProvider>
	)
}
