import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react'
import { cx } from './cx'
import styles from './Button.module.css'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: ReactNode
  /** Stretch to the container width. */
  block?: boolean
  /** Visual toggled state; also sets aria-pressed. */
  pressed?: boolean
  ref?: Ref<HTMLButtonElement>
}

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  block,
  pressed,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      aria-pressed={pressed}
      className={cx(
        styles.button,
        styles[variant],
        size !== 'md' && styles[size],
        block && styles.block,
        pressed && styles.pressed,
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  )
}

export interface IconButtonProps extends Omit<ButtonProps, 'children' | 'block'> {
  /** Accessible name; also shown as a native tooltip unless `title` is given. */
  label: string
  icon: ReactNode
}

export function IconButton({
  label,
  icon,
  variant = 'ghost',
  className,
  title,
  ...rest
}: IconButtonProps) {
  return (
    <Button
      aria-label={label}
      title={title ?? label}
      variant={variant}
      icon={icon}
      className={cx(styles.icon, className)}
      {...rest}
    />
  )
}
