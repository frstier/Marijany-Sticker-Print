---
description: Best practices for this project - coding standards and patterns
---

# Coding Best Practices

## UI/UX Patterns

### ❌ Avoid Native Browser Dialogs
**Never use** `window.alert()`, `window.confirm()`, or `window.prompt()`:
- They block the main thread
- Hard to style and brand
- Cause issues with React re-renders (dialogs may close instantly)
- Difficult to debug when something goes wrong

**Instead use**: Custom modal components like `ConfirmDialog.tsx`
```tsx
import ConfirmDialog from '../ConfirmDialog';

// Usage:
<ConfirmDialog
    isOpen={isDialogOpen}
    title="Заголовок"
    message="Опис дії"
    confirmText="Підтвердити"
    cancelText="Скасувати"
    variant="danger" // or "warning" | "info"
    onConfirm={handleConfirm}
    onCancel={handleCancel}
/>
```

### ✅ Custom Dialogs Benefits
- Fully stylable
- Consistent with app design
- No browser-specific behavior issues
- Easy to test and debug
