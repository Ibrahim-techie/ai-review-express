import { Slot } from '@radix-ui/react-slot'
import { AnimatePresence, motion } from 'motion/react'
import * as React from 'react'

import { cn } from '@/lib/utils'

const DisclosureContext = React.createContext(null)

function useDisclosure() {
  const ctx = React.use(DisclosureContext)
  if (!ctx) throw new Error('Disclosure parts must be inside <Disclosure>')
  return ctx
}

export function Disclosure({
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  openOnHover = false,
  className,
  children
}) {
  const [inner, setInner] = React.useState(defaultOpen)
  const open = openProp ?? inner
  const setOpen = React.useCallback((next) => {
    if (openProp === undefined) setInner(next)
    onOpenChange?.(next)
  }, [openProp, onOpenChange])
  const contentId = React.useId()
  return (
    <DisclosureContext value={{ open, setOpen, contentId }}>
      <div
        className={className}
        onPointerEnter={openOnHover ? (e) => e.pointerType === 'mouse' && setOpen(true) : undefined}
        onPointerLeave={openOnHover ? (e) => e.pointerType === 'mouse' && setOpen(false) : undefined}>
        {children}
      </div>
    </DisclosureContext>
  );
}

/** A button that toggles the content. Pass `asChild` to use your own <button>. */
export function DisclosureTrigger({
  asChild = false,
  className,
  onClick,
  ...props
}) {
  const { open, setOpen, contentId } = useDisclosure()
  const Comp = asChild ? Slot : 'button'
  return (
    <Comp
      type={asChild ? undefined : 'button'}
      aria-expanded={open}
      aria-controls={contentId}
      className={cn(
        'cursor-pointer outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
        className
      )}
      onClick={(e) => {
        onClick?.(e)
        if (!e.defaultPrevented) setOpen(!open)
      }}
      {...props} />
  );
}

export function DisclosureContent({
  className,
  children
}) {
  const { open, contentId } = useDisclosure()
  return (
    <div id={contentId} className={cn('overflow-hidden', className)}>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}>
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
