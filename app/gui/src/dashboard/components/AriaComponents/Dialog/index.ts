/**
 * @file
 *
 * Re-exports the Dialog component.
 */
export * from './Close'
export * from './Dialog'
export * from './DialogTrigger'
export * from './Popover'
export * from './variants'
 
export { useDialogContext, type DialogContextValue } from './DialogProvider'
export {
   
  DialogStackProvider,
   
  type DialogStackContextType,
   
  type DialogStackItem,
} from './DialogStackProvider'
