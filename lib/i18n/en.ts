import type { tr } from "./tr";

// TypeScript enforces that this has exactly the same keys as tr.ts — add a
// key there first, then here, or `tsc` will flag the mismatch.
export const en: Record<keyof typeof tr, string> = {
  // Common
  "common.cancel": "Cancel",
  "common.save": "Save",
  "common.close": "Close",

  // Formats
  "format.epub": "EPUB",
  "format.pdf": "PDF",
  "format.all": "All",

  // Biometric lock
  "biometric.notAvailable": "No fingerprint/face recognition set up on this device.",
  "biometric.reason": "Verify your identity to open the library",
  "biometric.failed": "Verification failed. Try again.",
  "biometric.locked": "Library locked",
  "biometric.unlock": "Unlock",
  "biometric.disableLock": "Disable lock",
  "biometric.disableLockConfirm": "This turns off the library lock entirely. Are you sure?",
  "biometric.disableLockConfirmYes": "Yes, disable",
  "biometric.disableLockConfirmNo": "Cancel",

  // Open file (share/open-with)
  "openFile.unsupportedType": "Unsupported file type.",
  "openFile.importedFilename": "Imported Book",
  "openFile.added": "Book added.",
  "openFile.failed": "Couldn't open the book.",

  // Backup menu
  "backup.shareTitle": "Library Backup",
  "backup.exportFailed": "Couldn't create the backup.",
  "backup.restoredOne": "1 book restored.",
  "backup.restoredMany": "{count} books restored.",
  "backup.importFailed": "Couldn't restore the backup.",
  "backup.ariaLabel": "Backup",
  "backup.export": "Back Up Library",
  "backup.import": "Restore from Backup",
  "backup.biometricLock": "Biometric Lock",

  // Book actions menu
  "bookActions.ariaLabel": "Book options",
  "bookActions.rename": "Rename",
  "bookActions.info": "Info",
  "bookActions.infoTitle": "Book Info",
  "bookActions.titleLabel": "Title",
  "bookActions.authorLabel": "Author",
  "bookActions.categoryLabel": "Category",
  "bookActions.uncategorized": "Uncategorized",
  "bookActions.formatLabel": "Format",
  "bookActions.sizeLabel": "Size",
  "bookActions.addedAtLabel": "Added",
  "bookActions.unknownAuthor": "Unknown Author",
  "bookActions.updated": "Book updated.",
  "bookActions.editTitle": "Edit Book",
  "bookActions.editDescription": "Edit the title, author, and the category it appears under on the shelf.",
  "bookActions.categoryPlaceholder": "e.g. Fiction, Sci-Fi",

  // Book card / list row
  "book.deleted": "Book deleted.",
  "book.confirmDelete": "Confirm delete",
  "book.delete": "Delete book",

  // Category dialog
  "category.created": "Category \"{name}\" created.",
  "category.addTitle": "Add Category",
  "category.addDescription": "Pick a category name and choose the books that should appear under it on the shelf.",
  "category.nameLabel": "Category Name",
  "category.namePlaceholder": "e.g. Fiction, Sci-Fi",
  "category.booksLabel": "Books",
  "category.selectedCount": "({count} selected)",
  "category.noBooks": "No books yet.",

  // Library view
  "library.title": "My Library",
  "library.bookCount": "{count} books",
  "library.stats": "Your reading stats",
  "library.addCategory": "Add category",
  "library.addBook": "Add Book",
  "library.searchPlaceholder": "Search by title or author…",
  "library.sortRecent": "Recently Added",
  "library.sortTitle": "By Title",
  "library.sortAuthor": "By Author",
  "library.gridView": "Grid view",
  "library.listView": "List view",
  "library.shelfView": "Shelf view",
  "library.noSearchResults": "No books match your search.",
  "library.emptyTitle": "Your library is empty",
  "library.emptySubtitle": "Add your first book to start reading — EPUB or PDF.",
  "library.uploadTitle": "Add Book",
  "library.uploadDescription": "Drag and drop your EPUB or PDF file.",

  // Reading stats panel
  "stats.weekdayMon": "Mon",
  "stats.weekdayTue": "Tue",
  "stats.weekdayWed": "Wed",
  "stats.weekdayThu": "Thu",
  "stats.weekdayFri": "Fri",
  "stats.weekdaySat": "Sat",
  "stats.weekdaySun": "Sun",
  "stats.noneToday": "You haven't started reading today yet. Pick up anytime, from any page.",
  "stats.todayMinutes": "You spent {minutes} minutes in a book today ✨",
  "stats.todayHours": "You spent {hours}h {minutes}m in a book today ✨",
  "stats.title": "Your Reading Stats",
  "stats.streak": "🔥 {streak}-day reading streak — nice going.",
  "stats.last7Days": "Last 7 days",
  "stats.dailyGoal": "Daily Goal",
  "stats.decreaseGoal": "Decrease goal",
  "stats.minutesUnit": "{minutes} min",
  "stats.increaseGoal": "Increase goal",
  "stats.goalReached": "You've hit today's goal, nice 🎉",
  "stats.breakReminders": "Gentle break reminders",
  "stats.breakRemindersDescription": "During a long reading session, we can suggest a short break if you'd like.",
  "stats.notificationPermissionDenied": "Notification permission was denied, so break reminders can't be shown.",

  // Shelf view
  "shelf.categoryBookCount": "· {count} books",
  "shelf.notStarted": "Not started yet",
  "shelf.progress": "{percentage}% read · {relativeDate}",
  "shelf.sizeAndAdded": "{size} · added {date}",
  "shelf.uncategorized": "Uncategorized",

  // Relative date
  "relativeDate.today": "today",
  "relativeDate.yesterday": "yesterday",
  "relativeDate.daysAgo": "{days} days ago",
  "relativeDate.monthsAgo": "{months} months ago",
  "relativeDate.yearsAgo": "{years} years ago",

  // Upload dropzone
  "upload.importFailed": "Couldn't import the book.",
  "upload.importFailedWithFile": "{filename}: {message}",
  "upload.addedOne": "Book added.",
  "upload.addedMany": "{count} books added.",
  "upload.importing": "Importing book…",
  "upload.idle": "Upload an EPUB or PDF",
  "upload.hint": "Drag and drop, or click to choose",

  // Break suggestion
  "break.suggestion": "You've been reading for a while. Your eyes might appreciate a short break 🌿",
  "break.dismiss": "Dismiss",

  // Epub reader surface
  "epub.openTimeout": "Opening the EPUB timed out",

  // Notes panel
  "notes.exportFailed": "Export failed.",
  "notes.title": "My Notes",
  "notes.export": "Export",
  "notes.exportWord": "Download as Word (.docx)",
  "notes.exportPdf": "Download as PDF",
  "notes.highlightsCount": "Highlights ({count})",
  "notes.bookmarksCount": "Bookmarks ({count})",
  "notes.noHighlights": "No highlights yet. Select some text and choose a color and importance to highlight it.",
  "notes.importanceLevel": "Importance level {level}",
  "notes.editNote": "Edit note",
  "notes.deleteHighlight": "Delete highlight",
  "notes.noBookmarks": "No bookmarks yet. Tap the bookmark icon above to add one.",
  "notes.locationFallback": "Location",
  "notes.deleteBookmark": "Delete bookmark",
  "notes.noteDialogTitle": "Note",
  "notes.notePlaceholder": "Add a note about this highlight…",

  // PDF reader surface
  "pdf.zoomOut": "Zoom out",
  "pdf.zoomIn": "Zoom in",
  "pdf.pageMode": "Page mode",
  "pdf.scrollMode": "Scroll mode",

  // Reader onboarding
  "onboarding.swipe": "Swipe left or right to turn pages",
  "onboarding.tap": "Tap the screen to show or hide the menu",
  "onboarding.gotIt": "Got it",

  // Reader settings panel
  "theme.light": "Light",
  "theme.cream": "Cream",
  "theme.sepia": "Sepia",
  "theme.dark": "Dark",
  "theme.coffee": "Coffee",
  "theme.oledBlack": "Black",
  "theme.custom": "Custom",
  "font.literata": "Literata",
  "font.lora": "Lora",
  "font.garamond": "Garamond",
  "font.sans": "Sans",
  "font.dyslexic": "Dyslexic",
  "settings.title": "Reading Settings",
  "settings.theme": "Theme",
  "settings.background": "Background",
  "settings.textColor": "Text",
  "settings.autoNightMode": "Automatic Night Mode",
  "settings.brightness": "Brightness",
  "settings.contrast": "Contrast",
  "settings.warmth": "Warmth",
  "settings.fontFamily": "Font",
  "settings.lineHeight": "Line Height",
  "settings.layout": "Layout",
  "settings.margin": "Margin",
  "settings.scrollMode": "Continuous Scroll",
  "settings.volumeKeyPageTurn": "Turn Pages with Volume Buttons",
  "settings.columns": "Columns",
  "settings.pageTurnAnimation": "Page Turn Animation",
  "pageTurnAnimation.off": "Off",
  "pageTurnAnimation.soft": "Soft",
  "pageTurnAnimation.realistic": "Realistic",

  // Reader view
  "reader.openError": "This book couldn't be opened — the file may be corrupt or in an unsupported format.",
  "reader.noTextOnPage": "No readable text found on this page.",
  "reader.pageLabel": "Page {page}",
  "reader.locationFallback": "Location",
  "reader.bookNotFound": "This book couldn't be found.",
  "reader.fileMissing":
    "The book record exists, but its file is missing from this device. Add the book to your library again.",
  "reader.loadError":
    "Something went wrong while loading the book data. Return to the library and try again.",
  "reader.loading": "Loading book",
  "reader.backToLibrary": "Back to library",
  "reader.stopReadAloud": "Stop reading aloud",
  "reader.readAloud": "Read aloud",
  "reader.searchInBook": "Search in book",
  "reader.notes": "My Notes",
  "reader.removeBookmark": "Remove bookmark",
  "reader.addBookmark": "Add bookmark",
  "reader.toc": "Table of Contents",
  "reader.settings": "Settings",

  // Search panel
  "search.title": "Search in Book",
  "search.placeholder": "Search…",
  "search.noResults": "No results found.",

  // Selection bar
  "selection.cancel": "Cancel",
  "selection.chooseColor": "Choose {color}",
  "selection.importanceLevel": "Importance level {level}",
  "selection.highlight": "Highlight",

  // TOC panel
  "toc.title": "Table of Contents",
  "toc.unnamedChapter": "Untitled Chapter",

  // App metadata
  "app.title": "My Library",
  "app.description": "An e-ink-feel EPUB/PDF reader",

  // Import book
  "importBook.unsupportedType": "Unsupported file type: {filename}",
  "importBook.unknownAuthor": "Unknown Author",

  // Loaders
  "epubLoader.untitledBook": "Untitled Book",
  "epubLoader.unknownAuthor": "Unknown Author",
  "pdfLoader.unknownAuthor": "Unknown Author",

  // Backup (lib)
  "backupLib.invalidFile": "Invalid backup file (manifest not found).",
  "backupLib.newerVersion": "This backup was created with a newer version of the app.",

  // Export notes
  "exportNotes.defaultBookName": "Book",
  "exportNotes.noHighlights": "No highlights added yet.",
  "exportNotes.wordFilename": "{title} - Notes.docx",
  "exportNotes.pdfFilename": "{title} - Notes.pdf",
  "importance.normal": "Normal",
  "importance.important": "Important",
  "importance.veryImportant": "Very Important",
  "importance.critical": "Critical",

  // Native UI (notifications, shortcuts)
  "native.breakReminderTitle": "Time for a break?",
  "native.breakReminderBody": "You've been reading for a while — rest your eyes.",
  "native.continueReadingShortcut": "Continue: {title}",

  // Language switcher
  "language.label": "Language",
  "language.turkish": "Türkçe",
  "language.english": "English",

  // Account / cloud sync
  "account.ariaLabel": "Account",
  "account.description": "Sync your library with your account. Using the app without an account keeps working as always.",
  "account.signInTitle": "Sign In",
  "account.signUpTitle": "Create Account",
  "account.signedInTitle": "Signed in",
  "account.continueWithGoogle": "Continue with Google",
  "account.orDivider": "or",
  "account.emailLabel": "Email",
  "account.passwordLabel": "Password",
  "account.forgotPassword": "Forgot password",
  "account.signIn": "Sign In",
  "account.signUp": "Create Account",
  "account.signOut": "Sign Out",
  "account.switchToSignUp": "Don't have an account? Create one",
  "account.switchToSignIn": "Already have an account? Sign in",
  "account.resetEmailSent": "Password reset email sent.",
  "account.errorWrongPassword": "Wrong email or password.",
  "account.errorEmailInUse": "This email is already in use.",
  "account.errorWeakPassword": "Password is too weak, use at least 6 characters.",
  "account.errorInvalidEmail": "Invalid email address.",
  "account.errorUserNotFound": "No account found for this email.",
  "account.errorGeneric": "Something went wrong. Please try again.",
};
