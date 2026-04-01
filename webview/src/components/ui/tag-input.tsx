import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { X } from "lucide-react"

export interface TagInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  value: string
  onValueChange: (value: string) => void
}

export const TagInput = React.forwardRef<HTMLInputElement, TagInputProps>(
  ({ value, onValueChange, className, disabled, ...props }, ref) => {
    const tags = value.split(",").map(t => t.trim()).filter(Boolean)
    const [inputValue, setInputValue] = React.useState("")
    const inputRef = React.useRef<HTMLInputElement>(null)

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" || e.key === ",") {
        e.preventDefault()
        const newTag = inputValue.trim()
        if (newTag && !tags.includes(newTag)) {
          onValueChange([...tags, newTag].join(", "))
          setInputValue("")
        }
      } else if (e.key === "Backspace" && inputValue === "" && tags.length > 0) {
        onValueChange(tags.slice(0, -1).join(", "))
      }
    }

    const removeTag = (tagToRemove: string) => {
      onValueChange(tags.filter(tag => tag !== tagToRemove).join(", "))
    }

    return (
      <div 
        className={`flex min-h-7 w-full flex-wrap items-center gap-1.5 rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 ${disabled ? 'cursor-not-allowed opacity-50' : ''} ${className || ''}`}
        onClick={() => inputRef.current?.focus()}
      >
        {tags.map((tag) => (
          <Badge key={tag} variant="secondary" className="h-[18px] px-1.5 py-0 text-[10px] font-normal gap-1 font-mono pointer-events-auto">
            {tag}
            {!disabled && (
              <X 
                className="size-2.5 cursor-pointer opacity-50 hover:opacity-100 transition-opacity" 
                onClick={(e) => {
                  e.stopPropagation()
                  removeTag(tag)
                }}
              />
            )}
          </Badge>
        ))}
        <input
          {...props}
          ref={(node) => {
            // @ts-ignore
            inputRef.current = node
            if (typeof ref === 'function') ref(node)
            else if (ref) ref.current = node
          }}
          className="flex-1 min-w-[50px] bg-transparent outline-none disabled:cursor-not-allowed font-mono text-[10px]"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            const newTag = inputValue.trim()
            if (newTag && !tags.includes(newTag)) {
              onValueChange([...tags, newTag].join(", "))
            }
            setInputValue("")
          }}
          disabled={disabled}
        />
      </div>
    )
  }
)
TagInput.displayName = "TagInput"
