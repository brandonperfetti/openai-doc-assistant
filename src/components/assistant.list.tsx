'use client'

import { ExtendedAssistant } from '@/components/main'
import { useEventRunDetails } from '@trigger.dev/react'
import { FC, useEffect, useState } from 'react'

export const Loading: FC<{ eventId: string; onFinish: () => void }> = props => {
	const { eventId } = props
	const { data, error } = useEventRunDetails(eventId)
	const [showError, setShowError] = useState(true) // State to manage error visibility
	const [showLoading, setShowLoading] = useState(true) // State to manage loading indicator visibility

	console.log(data, error)

	useEffect(() => {
		if (!data) return

		if (data.status === 'FAILURE') {
			console.error('Error:', data.output.message) // Log the error
			const timer = setTimeout(() => {
				setShowError(false) // Hide the error after 5 seconds
				setShowLoading(false)
			}, 5000)

			return () => clearTimeout(timer) // Clear the timer if the component unmounts
		} else if (data.status === 'SUCCESS') {
			props.onFinish()
		}
	}, [data, props])

	// Inside your return statement, check if the status is 'FAILURE' and display the error message
	if (data && data.status === 'FAILURE' && showError) {
		return (
			<div>
				<div className="pointer bg-red-300 border-red-500 p-1 px-3 text-red-950 border rounded-2xl">
					Error: {data.output.message}
				</div>
			</div>
		)
	}

	if (data && data.status === 'EXECUTING') {
		return (
			<div className="pointer bg-yellow-300 border-yellow-500 p-1 px-3 text-yellow-950 border rounded-2xl">
				Processing Documentation
			</div>
		)
	}

	if (data && data.status === 'WAITING_TO_CONTINUE') {
		return (
			<div className="pointer bg-yellow-300 border-yellow-500 p-1 px-3 text-yellow-950 border rounded-2xl">
				Compiling Next Batch
			</div>
		)
	}

	if (error) {
		// If there's an error, display it instead of the loading message
		return (
			<div className="pointer bg-red-300 border-red-500 p-1 px-3 text-red-950 border rounded-2xl">
				Error: {error.message}
			</div>
		)
	}

	// Continue showing the loading indicator if there's no error
	if (showLoading) {
		return (
			<div className="pointer bg-yellow-300 border-yellow-500 p-1 px-3 text-yellow-950 border rounded-2xl">
				Loading
			</div>
		)
	}
}

export const AssistantList: FC<{
	val: ExtendedAssistant
	onFinish: () => void
}> = props => {
	const { val, onFinish } = props
	if (val.pending) {
		return <Loading eventId={val.eventId!} onFinish={onFinish} />
	}

	return (
		<div
			key={val.url}
			className="pointer relative bg-green-300 border-green-500 p-1 px-3 text-green-950 border rounded-2xl hover:bg-red-300 hover:border-red-500 hover:text-red-950 before:content-[attr(data-content)]"
			data-content={val.url}
		/>
		// <div></div>
		// <></>
	)
}
