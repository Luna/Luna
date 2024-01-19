/** @file A WebSocket-based chat directly to official support on the official Discord server. */
import * as React from 'react'

import * as reactDom from 'react-dom'
import * as toastify from 'react-toastify'

import CloseLargeIcon from 'enso-assets/close_large.svg'
import DefaultUserIcon from 'enso-assets/default_user.svg'
import TriangleDownIcon from 'enso-assets/triangle_down.svg'
import * as chat from 'enso-chat/chat'
import * as gtag from 'enso-common/src/gtag'

import * as authProvider from '#/providers/AuthProvider'
import * as loggerProvider from '#/providers/LoggerProvider'

import * as pageSwitcher from '#/layouts/dashboard/PageSwitcher'

import Twemoji from '#/components/Twemoji'

import * as config from '#/utilities/config'
import * as dateTime from '#/utilities/dateTime'
import * as newtype from '#/utilities/newtype'
import * as object from '#/utilities/object'

// ================
// === Newtypes ===
// ================

/** Create a {@link chat.MessageId}. */
const MessageId = newtype.newtypeConstructor<chat.MessageId>()

// =================
// === Constants ===
// =================

// TODO[sb]: Consider associating a project with a thread
// (and providing a button to jump to the relevant project).
// The project shouldn't be jumped to automatically, since it may take a long time
// to switch projects, and undo history may be lost.

export const HELP_CHAT_ID = 'enso-chat'
/** The size (both width and height) of each reaction button. */
const REACTION_BUTTON_SIZE = 20
/** The size (both width and height) of each reaction on a message. */
const REACTION_SIZE = 16
/** The list of reaction emojis, in order. */
const REACTION_EMOJIS: chat.ReactionSymbol[] = ['❤️', '👍', '👎', '😀', '🙁', '👀', '🎉']
/** The initial title of the thread. */
const DEFAULT_THREAD_TITLE = 'New chat thread'
/** A {@link RegExp} matching any non-whitespace character. */
const NON_WHITESPACE_CHARACTER_REGEX = /\S/
/** A {@link RegExp} matching auto-generated thread names. */
const AUTOGENERATED_THREAD_TITLE_REGEX = /^New chat thread (\d+)$/
/** The maximum number of lines to show in the message input, past which a scrollbar is shown. */
const MAX_MESSAGE_INPUT_LINES = 10
/** The maximum number of messages to fetch when opening a new thread.
 * This SHOULD be the same limit as the chat backend (the maximum number of messages sent in
 * `serverThread` events). */
const MAX_MESSAGE_HISTORY = 25

// ==========================
// === ChatDisplayMessage ===
// ==========================

/** Information needed to display a chat message. */
interface ChatDisplayMessage {
    id: chat.MessageId
    /** If `true`, this is a message from the staff to the user.
     * If `false`, this is a message from the user to the staff. */
    isStaffMessage: boolean
    avatar: string | null
    /** Name of the author of the message. */
    name: string
    content: string
    reactions: chat.ReactionSymbol[]
    /** Given in milliseconds since the unix epoch. */
    timestamp: number
    /** Given in milliseconds since the unix epoch. */
    editedTimestamp: number | null
}

// ==========================
// === makeNewThreadTitle ===
// ==========================

/** Returns an auto-generated thread title. */
function makeNewThreadTitle(threads: chat.ThreadData[]) {
    const threadTitleNumbers = threads
        .map(thread => thread.title.match(AUTOGENERATED_THREAD_TITLE_REGEX))
        .flatMap(match => (match != null ? parseInt(match[1] ?? '0', 10) : []))
    return `${DEFAULT_THREAD_TITLE} ${Math.max(0, ...threadTitleNumbers) + 1}`
}

// ===================
// === ReactionBar ===
// ===================

/** Props for a {@link ReactionBar}. */
export interface ReactionBarProps {
    selectedReactions: Set<chat.ReactionSymbol>
    doReact: (reaction: chat.ReactionSymbol) => void
    doRemoveReaction: (reaction: chat.ReactionSymbol) => void
    className?: string
}

/** A list of emoji reactions to choose from. */
function ReactionBar(props: ReactionBarProps) {
    const { selectedReactions, doReact, doRemoveReaction, className } = props

    return (
        <div className={`inline-block bg-white rounded-full m-1 ${className ?? ''}`}>
            {REACTION_EMOJIS.map(emoji => (
                <button
                    key={emoji}
                    onClick={() => {
                        if (selectedReactions.has(emoji)) {
                            doRemoveReaction(emoji)
                        } else {
                            doReact(emoji)
                        }
                    }}
                    // FIXME: Grayscale has the wrong lightness
                    className={`rounded-full hover:bg-gray-200 m-1 p-1 ${
                        selectedReactions.has(emoji) ? '' : 'opacity-70 grayscale hover:grayscale-0'
                    }`}
                >
                    <Twemoji key={emoji} emoji={emoji} size={REACTION_BUTTON_SIZE} />
                </button>
            ))}
        </div>
    )
}

// =================
// === Reactions ===
// =================

/** Props for a {@link Reactions}. */
export interface ReactionsProps {
    reactions: chat.ReactionSymbol[]
}

/** A list of emoji reactions that have been on a message. */
function Reactions(props: ReactionsProps) {
    const { reactions } = props

    if (reactions.length === 0) {
        return null
    } else {
        return (
            <div>
                {reactions.map(reaction => (
                    <Twemoji key={reaction} emoji={reaction} size={REACTION_SIZE} />
                ))}
            </div>
        )
    }
}

// ===================
// === ChatMessage ===
// ===================

/** Props for a {@link ChatMessage}. */
export interface ChatMessageProps {
    message: ChatDisplayMessage
    reactions: chat.ReactionSymbol[]
    shouldShowReactionBar: boolean
    doReact: (reaction: chat.ReactionSymbol) => void
    doRemoveReaction: (reaction: chat.ReactionSymbol) => void
}

/** A chat message, including user info, sent date, and reactions (if any). */
function ChatMessage(props: ChatMessageProps) {
    const { message, reactions, shouldShowReactionBar, doReact, doRemoveReaction } = props
    const [isHovered, setIsHovered] = React.useState(false)
    return (
        <div
            className="mx-4 my-2"
            onMouseEnter={() => {
                setIsHovered(true)
            }}
            onMouseLeave={() => {
                setIsHovered(false)
            }}
        >
            <div className="flex">
                <img
                    crossOrigin="anonymous"
                    src={message.avatar ?? DefaultUserIcon}
                    className="rounded-full h-8 w-8 my-1"
                />
                <div className="mx-2 leading-5">
                    <div className="font-bold">{message.name}</div>
                    <div className="text-opacity-50 text-primary">
                        {dateTime.formatDateTimeChatFriendly(new Date(message.timestamp))}
                    </div>
                </div>
            </div>
            <div className="whitespace-pre-wrap">
                {message.content}
                <Reactions reactions={reactions} />
            </div>
            {shouldShowReactionBar && (
                <ReactionBar
                    doReact={doReact}
                    doRemoveReaction={doRemoveReaction}
                    selectedReactions={new Set(message.reactions)}
                />
            )}
            {message.isStaffMessage && !shouldShowReactionBar && isHovered && (
                <div className="relative h-0 py-1 -my-1">
                    <ReactionBar
                        doReact={doReact}
                        doRemoveReaction={doRemoveReaction}
                        selectedReactions={new Set(message.reactions)}
                        className="absolute shadow-soft"
                    />
                </div>
            )}
        </div>
    )
}

// ==================
// === ChatHeader ===
// ==================

/** Props for a {@Link ChatHeader}. */
interface InternalChatHeaderProps {
    threads: chat.ThreadData[]
    setThreads: React.Dispatch<React.SetStateAction<chat.ThreadData[]>>
    threadId: chat.ThreadId | null
    threadTitle: string
    setThreadTitle: (threadTitle: string) => void
    switchThread: (threadId: chat.ThreadId) => void
    sendMessage: (message: chat.ChatClientMessageData) => void
    doClose: () => void
}

/** The header bar for a {@link Chat}. Includes the title, close button, and threads list. */
function ChatHeader(props: InternalChatHeaderProps) {
    const { threads, setThreads, threadId, threadTitle, setThreadTitle } = props
    const { switchThread, sendMessage, doClose } = props
    const [isThreadListVisible, setIsThreadListVisible] = React.useState(false)
    // These will never be `null` as their values are set immediately.
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const titleInputRef = React.useRef<HTMLInputElement>(null!)

    React.useEffect(() => {
        titleInputRef.current.value = threadTitle
    }, [threadTitle])

    React.useEffect(() => {
        const onClick = () => {
            setIsThreadListVisible(false)
        }
        document.addEventListener('click', onClick)
        gtag.event('cloud_open_chat')
        return () => {
            document.removeEventListener('click', onClick)
            gtag.event('cloud_close_chat')
        }
    }, [])

    const toggleThreadListVisibility = React.useCallback((event: React.SyntheticEvent) => {
        event.stopPropagation()
        setIsThreadListVisible(visible => !visible)
    }, [])

    return (
        <>
            <div className="flex text-sm font-semibold mx-4 mt-2">
                <button className="flex grow items-center" onClick={toggleThreadListVisibility}>
                    <img
                        className={`transition-transform duration-300 ${
                            isThreadListVisible ? '-rotate-180' : ''
                        }`}
                        src={TriangleDownIcon}
                    />
                    {/* Spacing. */}
                    <div className="w-2" />
                    <div className="grow">
                        <input
                            type="text"
                            ref={titleInputRef}
                            defaultValue={threadTitle}
                            className="bg-transparent w-full leading-6"
                            onClick={event => {
                                event.stopPropagation()
                            }}
                            onKeyDown={event => {
                                switch (event.key) {
                                    case 'Escape': {
                                        event.currentTarget.value = threadTitle
                                        break
                                    }
                                    case 'Enter': {
                                        event.currentTarget.blur()
                                        break
                                    }
                                }
                            }}
                            onBlur={event => {
                                const newTitle = event.currentTarget.value
                                setThreadTitle(newTitle)
                                if (threadId != null) {
                                    setThreads(oldThreads =>
                                        oldThreads.map(thread =>
                                            thread.id !== threadId
                                                ? thread
                                                : object.merge(thread, { title: newTitle })
                                        )
                                    )
                                    sendMessage({
                                        type: chat.ChatMessageDataType.renameThread,
                                        title: newTitle,
                                        threadId: threadId,
                                    })
                                }
                            }}
                        />
                    </div>
                </button>
                <button className="mx-1" onClick={doClose}>
                    <img src={CloseLargeIcon} />
                </button>
            </div>
            <div className="relative text-sm font-semibold">
                <div
                    className={`grid absolute shadow-soft clip-path-bottom-shadow bg-ide-bg backdrop-blur-3xl overflow-hidden transition-grid-template-rows w-full z-1 ${
                        isThreadListVisible ? 'grid-rows-1fr' : 'grid-rows-0fr'
                    }`}
                >
                    <div className="min-h-0 max-h-70 overflow-y-auto">
                        {threads.map(thread => (
                            <div
                                key={thread.id}
                                className={`flex p-1 ${
                                    thread.id === threadId
                                        ? 'cursor-default bg-gray-350'
                                        : 'cursor-pointer hover:bg-gray-300'
                                }`}
                                onClick={event => {
                                    event.stopPropagation()
                                    if (thread.id !== threadId) {
                                        switchThread(thread.id)
                                        setIsThreadListVisible(false)
                                    }
                                }}
                            >
                                <div className="w-8 text-center">
                                    {/* {thread.hasUnreadMessages ? '(!) ' : ''} */}
                                </div>
                                <div>{thread.title}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </>
    )
}

// ============
// === Chat ===
// ============

/** Props for a {@link Chat}. */
export interface ChatProps {
    page: pageSwitcher.Page
    /** This should only be false when the panel is closing. */
    isOpen: boolean
    doClose: () => void
}

/** Chat sidebar. */
export default function Chat(props: ChatProps) {
    const { page, isOpen, doClose } = props
    const { accessToken: rawAccessToken } = authProvider.useNonPartialUserSession()
    const logger = loggerProvider.useLogger()

    /** This is SAFE, because this component is only rendered when `accessToken` is present.
     * See `dashboard.tsx` for its sole usage. */
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const accessToken = rawAccessToken!

    const [isPaidUser, setIsPaidUser] = React.useState(true)
    const [isReplyEnabled, setIsReplyEnabled] = React.useState(false)
    // `true` if and only if scrollback was triggered for the current thread.
    const [shouldIgnoreMessageLimit, setShouldIgnoreMessageLimit] = React.useState(false)
    const [isAtBeginning, setIsAtBeginning] = React.useState(false)
    const [threads, setThreads] = React.useState<chat.ThreadData[]>([])
    const [messages, setMessages] = React.useState<ChatDisplayMessage[]>([])
    const [threadId, setThreadId] = React.useState<chat.ThreadId | null>(null)
    const [threadTitle, setThreadTitle] = React.useState(DEFAULT_THREAD_TITLE)
    const [isAtTop, setIsAtTop] = React.useState(false)
    const [isAtBottom, setIsAtBottom] = React.useState(true)
    const [messagesHeightBeforeMessageHistory, setMessagesHeightBeforeMessageHistory] =
        React.useState<number | null>(null)
    const [webSocket, setWebsocket] = React.useState<WebSocket | null>(null)
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const messageInputRef = React.useRef<HTMLTextAreaElement>(null!)
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const messagesRef = React.useRef<HTMLDivElement>(null!)

    React.useEffect(() => {
        setIsPaidUser(false)
    }, [])

    React.useEffect(() => {
        if (isOpen) {
            const newWebSocket = new WebSocket(config.ACTIVE_CONFIG.chatUrl)
            setWebsocket(newWebSocket)
            return () => {
                if (newWebSocket.readyState === WebSocket.OPEN) {
                    newWebSocket.close()
                } else {
                    newWebSocket.addEventListener('open', () => {
                        newWebSocket.close()
                    })
                }
            }
        } else {
            return
        }
    }, [isOpen])

    React.useLayoutEffect(() => {
        const element = messagesRef.current
        if (isAtTop && messagesHeightBeforeMessageHistory != null) {
            element.scrollTop = element.scrollHeight - messagesHeightBeforeMessageHistory
            setMessagesHeightBeforeMessageHistory(null)
        } else if (isAtBottom) {
            element.scrollTop = element.scrollHeight - element.clientHeight
        }
        // Auto-scroll MUST only happen when the message list changes.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [messages])

    const sendMessage = React.useCallback(
        (message: chat.ChatClientMessageData) => {
            webSocket?.send(JSON.stringify(message))
        },
        [webSocket]
    )

    React.useEffect(() => {
        const onMessage = (data: MessageEvent) => {
            if (typeof data.data !== 'string') {
                logger.error('Chat cannot handle binary messages.')
            } else {
                // This is SAFE, as the format of server messages is known.
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                const message: chat.ChatServerMessageData = JSON.parse(data.data)
                switch (message.type) {
                    case chat.ChatMessageDataType.serverThreads: {
                        setThreads(message.threads)
                        break
                    }
                    case chat.ChatMessageDataType.serverThread: {
                        if (!threads.some(thread => thread.id === message.id)) {
                            setThreads(oldThreads => {
                                const newThread = {
                                    id: message.id,
                                    title: message.title,
                                    hasUnreadMessages: false,
                                }
                                if (!oldThreads.some(thread => thread.id === message.id)) {
                                    return [...oldThreads, newThread]
                                } else {
                                    return oldThreads.map(oldThread =>
                                        oldThread.id === newThread.id ? newThread : oldThread
                                    )
                                }
                            })
                        }
                        setShouldIgnoreMessageLimit(false)
                        setThreadId(message.id)
                        setThreadTitle(message.title)
                        setIsAtBeginning(message.isAtBeginning)
                        const newMessages = message.messages.flatMap(innerMessage => {
                            switch (innerMessage.type) {
                                case chat.ChatMessageDataType.serverMessage: {
                                    const displayMessage: ChatDisplayMessage = {
                                        id: innerMessage.id,
                                        isStaffMessage: true,
                                        content: innerMessage.content,
                                        reactions: innerMessage.reactions,
                                        avatar: innerMessage.authorAvatar,
                                        name: innerMessage.authorName,
                                        timestamp: innerMessage.timestamp,
                                        editedTimestamp: innerMessage.editedTimestamp,
                                    }
                                    return displayMessage
                                }
                                case chat.ChatMessageDataType.serverReplayedMessage: {
                                    const displayMessage: ChatDisplayMessage = {
                                        id: innerMessage.id,
                                        isStaffMessage: false,
                                        content: innerMessage.content,
                                        reactions: [],
                                        avatar: null,
                                        name: 'Me',
                                        timestamp: innerMessage.timestamp,
                                        editedTimestamp: null,
                                    }
                                    return displayMessage
                                }
                            }
                        })
                        switch (message.requestType) {
                            case chat.ChatMessageDataType.historyBefore: {
                                setMessages(oldMessages => [...newMessages, ...oldMessages])
                                break
                            }
                            default: {
                                setMessages(newMessages)
                                break
                            }
                        }
                        break
                    }
                    case chat.ChatMessageDataType.serverMessage: {
                        const newMessage: ChatDisplayMessage = {
                            id: message.id,
                            isStaffMessage: true,
                            avatar: message.authorAvatar,
                            name: message.authorName,
                            content: message.content,
                            reactions: [],
                            timestamp: message.timestamp,
                            editedTimestamp: null,
                        }
                        setMessages(oldMessages => {
                            const newMessages = [...oldMessages, newMessage]
                            return shouldIgnoreMessageLimit
                                ? newMessages
                                : newMessages.slice(-MAX_MESSAGE_HISTORY)
                        })
                        break
                    }
                    case chat.ChatMessageDataType.serverEditedMessage: {
                        setMessages(
                            messages.map(otherMessage =>
                                otherMessage.id !== message.id
                                    ? otherMessage
                                    : object.merge(otherMessage, {
                                          content: message.content,
                                          editedTimestamp: message.timestamp,
                                      })
                            )
                        )
                        break
                    }
                    case chat.ChatMessageDataType.serverReplayedMessage: {
                        // This message is only sent as part of the `serverThread` message and
                        // can safely be ignored.
                        break
                    }
                }
            }
        }
        const onOpen = () => {
            sendMessage({
                type: chat.ChatMessageDataType.authenticate,
                accessToken,
            })
        }
        webSocket?.addEventListener('message', onMessage)
        webSocket?.addEventListener('open', onOpen)
        return () => {
            webSocket?.removeEventListener('message', onMessage)
            webSocket?.removeEventListener('open', onOpen)
        }
    }, [webSocket, shouldIgnoreMessageLimit, logger, threads, messages, accessToken, sendMessage])

    const container = document.getElementById(HELP_CHAT_ID)

    const switchThread = React.useCallback(
        (newThreadId: chat.ThreadId) => {
            const threadData = threads.find(thread => thread.id === newThreadId)
            if (threadData == null) {
                const message = `Unknown thread id '${newThreadId}'.`
                toastify.toast.error(message)
                logger.error(message)
            } else {
                sendMessage({
                    type: chat.ChatMessageDataType.switchThread,
                    threadId: newThreadId,
                })
            }
        },
        [threads, /* should never change */ sendMessage, /* should never change */ logger]
    )

    const sendCurrentMessage = React.useCallback(
        (event: React.SyntheticEvent, createNewThread?: boolean) => {
            event.preventDefault()
            const element = messageInputRef.current
            const content = element.value
            if (NON_WHITESPACE_CHARACTER_REGEX.test(content)) {
                setIsReplyEnabled(false)
                element.value = ''
                element.style.height = '0px'
                element.style.height = `${element.scrollHeight}px`
                const newMessage: ChatDisplayMessage = {
                    // This MUST be unique.
                    id: MessageId(String(Number(new Date()))),
                    isStaffMessage: false,
                    avatar: null,
                    name: 'Me',
                    content,
                    reactions: [],
                    timestamp: Number(new Date()),
                    editedTimestamp: null,
                }
                if (threadId == null || createNewThread === true) {
                    const newThreadTitle =
                        threadId == null ? threadTitle : makeNewThreadTitle(threads)
                    sendMessage({
                        type: chat.ChatMessageDataType.newThread,
                        title: newThreadTitle,
                        content,
                    })
                    setThreadId(null)
                    setThreadTitle(newThreadTitle)
                    setMessages([newMessage])
                } else {
                    sendMessage({
                        type: chat.ChatMessageDataType.message,
                        threadId,
                        content,
                    })
                    setMessages(oldMessages => {
                        const newMessages = [...oldMessages, newMessage]
                        return shouldIgnoreMessageLimit
                            ? newMessages
                            : newMessages.slice(-MAX_MESSAGE_HISTORY)
                    })
                }
            }
        },
        [
            threads,
            threadId,
            threadTitle,
            shouldIgnoreMessageLimit,
            /* should never change */ sendMessage,
        ]
    )

    const upgradeToPro = () => {
        // TODO:
    }

    if (container == null) {
        logger.error('Chat container not found.')
        return null
    } else {
        // This should be `findLast`, but that requires ES2023.
        const lastStaffMessage = [...messages].reverse().find(message => message.isStaffMessage)

        return reactDom.createPortal(
            <div
                className={`text-xs text-chat flex flex-col fixed top-0 right-0 backdrop-blur-3xl h-screen border-ide-bg-dark border-l-2 w-83.5 py-1 z-1 transition-transform ${
                    page === pageSwitcher.Page.editor ? 'bg-ide-bg' : 'bg-frame-selected'
                } ${isOpen ? '' : 'translate-x-full'}`}
            >
                <ChatHeader
                    threads={threads}
                    setThreads={setThreads}
                    threadId={threadId}
                    threadTitle={threadTitle}
                    setThreadTitle={setThreadTitle}
                    switchThread={switchThread}
                    sendMessage={sendMessage}
                    doClose={doClose}
                />
                <div
                    ref={messagesRef}
                    className="flex-1 overflow-scroll"
                    onScroll={event => {
                        const element = event.currentTarget
                        const isNowAtTop = element.scrollTop === 0
                        const isNowAtBottom =
                            element.scrollTop + element.clientHeight === element.scrollHeight
                        const firstMessage = messages[0]
                        if (isNowAtTop && !isAtBeginning && firstMessage != null) {
                            setShouldIgnoreMessageLimit(true)
                            sendMessage({
                                type: chat.ChatMessageDataType.historyBefore,
                                messageId: firstMessage.id,
                            })
                            setMessagesHeightBeforeMessageHistory(element.scrollHeight)
                        }
                        if (isNowAtTop !== isAtTop) {
                            setIsAtTop(isNowAtTop)
                        }
                        if (isNowAtBottom !== isAtBottom) {
                            setIsAtBottom(isNowAtBottom)
                        }
                    }}
                >
                    {messages.map(message => (
                        <ChatMessage
                            key={message.id}
                            message={message}
                            reactions={[]}
                            doReact={reaction => {
                                sendMessage({
                                    type: chat.ChatMessageDataType.reaction,
                                    messageId: message.id,
                                    reaction,
                                })
                                setMessages(oldMessages =>
                                    oldMessages.map(oldMessage =>
                                        oldMessage.id === message.id
                                            ? object.merge(message, {
                                                  reactions: [...oldMessage.reactions, reaction],
                                              })
                                            : oldMessage
                                    )
                                )
                            }}
                            doRemoveReaction={reaction => {
                                sendMessage({
                                    type: chat.ChatMessageDataType.removeReaction,
                                    messageId: message.id,
                                    reaction,
                                })
                                setMessages(oldMessages =>
                                    oldMessages.map(oldMessage =>
                                        oldMessage.id === message.id
                                            ? object.merge(message, {
                                                  reactions: oldMessage.reactions.filter(
                                                      oldReaction => oldReaction !== reaction
                                                  ),
                                              })
                                            : oldMessage
                                    )
                                )
                            }}
                            shouldShowReactionBar={
                                message === lastStaffMessage || message.reactions.length !== 0
                            }
                        />
                    ))}
                </div>
                <form className="rounded-2xl bg-white p-1 mx-2 my-1" onSubmit={sendCurrentMessage}>
                    <textarea
                        ref={messageInputRef}
                        rows={1}
                        autoFocus
                        required
                        placeholder="Type your message ..."
                        className="w-full rounded-lg resize-none p-1"
                        onKeyDown={event => {
                            switch (event.key) {
                                case 'Enter': {
                                    // If the shift key is not pressed, submit the form.
                                    // If the shift key is pressed, keep the default
                                    // behavior of adding a newline.
                                    if (!event.shiftKey) {
                                        event.preventDefault()
                                        event.currentTarget.form?.requestSubmit()
                                    }
                                }
                            }
                        }}
                        onInput={event => {
                            const element = event.currentTarget
                            element.style.height = '0px'
                            element.style.height =
                                `min(${MAX_MESSAGE_INPUT_LINES}lh,` +
                                `${element.scrollHeight + 1}px)`
                            const newIsReplyEnabled = NON_WHITESPACE_CHARACTER_REGEX.test(
                                element.value
                            )
                            if (newIsReplyEnabled !== isReplyEnabled) {
                                setIsReplyEnabled(newIsReplyEnabled)
                            }
                        }}
                    />
                    <div className="flex">
                        <button
                            type="button"
                            disabled={!isReplyEnabled}
                            className={`text-xxs text-white rounded-full grow text-left px-1.5 py-1 ${
                                isReplyEnabled ? 'bg-gray-400' : 'bg-gray-300'
                            }`}
                            onClick={event => {
                                sendCurrentMessage(event, true)
                            }}
                        >
                            New question? Click to start a new thread!
                        </button>
                        {/* Spacing. */}
                        <div className="w-0.5" />
                        <button
                            type="submit"
                            disabled={!isReplyEnabled}
                            className={`text-white bg-blue-600 rounded-full px-1.5 py-1 ${
                                isReplyEnabled ? '' : 'opacity-50'
                            }`}
                        >
                            Reply!
                        </button>
                    </div>
                </form>
                {!isPaidUser && (
                    <button
                        className="text-left leading-5 rounded-2xl bg-call-to-action text-white p-2 mx-2 my-1"
                        onClick={upgradeToPro}
                    >
                        Click here to upgrade to Enso Pro and get access to high-priority, live
                        support!
                    </button>
                )}
            </div>,
            container
        )
    }
}
