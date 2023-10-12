/** @file Managing the logic and displaying the UI for the password change function. */
import * as React from 'react'

import ArrowRightIcon from 'enso-assets/arrow_right.svg'
import LockIcon from 'enso-assets/lock.svg'

import * as auth from '../../authentication/providers/auth'
import * as modalProvider from '../../providers/modal'
import * as string from '../../string'
import * as validation from '../validation'

import Input from './input'
import Modal from './modal'
import SvgIcon from './svgIcon'
import SvgMask from '../../authentication/components/svgMask'

// ==========================
// === ResetPasswordModal ===
// ==========================

/** A modal for changing the user's password. */
export default function ChangePasswordModal() {
    const { changePassword } = auth.useAuth()
    const { unsetModal } = modalProvider.useSetModal()

    const [oldPassword, setOldPassword] = React.useState('')
    const [newPassword, setNewPassword] = React.useState('')
    const [confirmNewPassword, setConfirmNewPassword] = React.useState('')
    const [isSubmitting, setIsSubmitting] = React.useState(false)

    return (
        <Modal centered className="bg-dim">
            <div
                data-testid="change-password-modal"
                className="flex w-full max-w-md flex-col rounded-2xl bg-frame-selected p-8 backdrop-blur-3xl"
                onClick={event => {
                    event.stopPropagation()
                }}
            >
                <div className="self-center text-xl">Change Your Password</div>
                <div className="mt-10">
                    <form
                        className="flex flex-col gap-6"
                        onSubmit={async event => {
                            event.preventDefault()
                            setIsSubmitting(true)
                            const success = await changePassword(oldPassword, newPassword)
                            setIsSubmitting(false)
                            if (success) {
                                unsetModal()
                            }
                        }}
                    >
                        <div className="flex flex-col gap-1">
                            <label htmlFor="old_password">Old Password:</label>
                            <div className="relative">
                                <SvgIcon>
                                    <SvgMask src={LockIcon} />
                                </SvgIcon>
                                <Input
                                    autoFocus
                                    required
                                    validate
                                    id="old_password"
                                    type="password"
                                    name="old_password"
                                    autoComplete="current-password"
                                    placeholder="Old Password"
                                    pattern={validation.PASSWORD_PATTERN}
                                    error={validation.PASSWORD_ERROR}
                                    value={oldPassword}
                                    setValue={setOldPassword}
                                    className="w-full rounded-2xl py-2 pl-10 pr-4 text-sm placeholder-gray-500 focus:border-blue-400 focus:outline-none"
                                />
                            </div>
                        </div>
                        <div className="flex flex-col gap-1">
                            <label htmlFor="new_password">New Password:</label>
                            <div className="relative">
                                <SvgIcon>
                                    <SvgMask src={LockIcon} />
                                </SvgIcon>
                                <Input
                                    required
                                    validate
                                    id="new_password"
                                    type="password"
                                    name="new_password"
                                    autoComplete="new-password"
                                    placeholder="New Password"
                                    pattern={validation.PASSWORD_PATTERN}
                                    error={validation.PASSWORD_ERROR}
                                    value={newPassword}
                                    setValue={setNewPassword}
                                    className="w-full rounded-full py-2 pl-10 pr-4 text-sm placeholder-gray-500"
                                />
                            </div>
                        </div>
                        <div className="flex flex-col gap-1">
                            <label htmlFor="confirm_new_password">Confirm New Password:</label>
                            <div className="relative">
                                <SvgIcon>
                                    <SvgMask src={LockIcon} />
                                </SvgIcon>
                                <Input
                                    required
                                    validate
                                    id="confirm_new_password"
                                    type="password"
                                    name="confirm_new_password"
                                    autoComplete="new-password"
                                    placeholder="Confirm New Password"
                                    pattern={string.regexEscape(newPassword)}
                                    error={validation.CONFIRM_PASSWORD_ERROR}
                                    value={confirmNewPassword}
                                    setValue={setConfirmNewPassword}
                                    className="w-full rounded-full py-2 pl-10 pr-4 text-sm placeholder-gray-500"
                                />
                            </div>
                        </div>
                        <button
                            disabled={isSubmitting}
                            type="submit"
                            className="flex h-10 items-center justify-center gap-2 rounded-full bg-cloud text-sm text-white disabled:opacity-50"
                        >
                            Reset
                            <SvgMask src={ArrowRightIcon} />
                        </button>
                    </form>
                </div>
            </div>
        </Modal>
    )
}
