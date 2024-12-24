import { act, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Await } from '../Await'

export function AwaitTest() {
  return <Await promise={Promise.resolve('Hello')}>{(value) => <div>{value}</div>}</Await>
}

describe('<Await />', () => {
  it('should the suspense boundary before promise is resolved, then show the children once promise is resolved', async () => {
    const promise = Promise.resolve('Hello')
    render(<Await promise={promise}>{(value) => <div>{value}</div>}</Await>)

    expect(screen.queryByText('Hello')).not.toBeInTheDocument()
    expect(screen.getByTestId('spinner')).toBeInTheDocument()

    await act(() => promise)

    expect(screen.getByText('Hello')).toBeInTheDocument()
    expect(screen.queryByTestId('spinner')).not.toBeInTheDocument()
  })

  // This test is SUPPOSED to throw an error,
  // Because the only way to test the error boundary is to throw an error during the render phase.
  it('should show the fallback if the promise is rejected', async () => {
    // Suppress the error message from the console caused by React Error Boundary
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})

    const promise = Promise.reject(new Error('Hello'))

    render(<Await promise={promise}>{(value) => <div>{value}</div>}</Await>)

    expect(screen.getByTestId('spinner')).toBeInTheDocument()

    await act(async () => {
      return promise.catch(() => {})
    })

    expect(screen.queryByText('Hello')).not.toBeInTheDocument()
    expect(screen.queryByTestId('spinner')).not.toBeInTheDocument()
    expect(screen.getByTestId('error-display')).toBeInTheDocument()
    // eslint-disable-next-line no-restricted-properties
    expect(console.error).toHaveBeenCalled()
  })

  it('should not display the Suspense boundary of the second Await if the first Await already resolved', async () => {
    const promise = Promise.resolve('Hello')
    const { unmount } = render(<Await promise={promise}>{(value) => <div>{value}</div>}</Await>)

    await act(() => promise)

    expect(screen.getByText('Hello')).toBeInTheDocument()

    unmount()

    render(<Await promise={promise}>{(value) => <div>{value}</div>}</Await>)

    expect(screen.getByText('Hello')).toBeInTheDocument()
  })
})
