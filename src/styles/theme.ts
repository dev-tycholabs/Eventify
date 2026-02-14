/**
 * Eventify Theme Configuration
 * 
 * This file contains all theme constants used across the application.
 * Import these values to maintain consistent styling throughout the app.
 */

export const theme = {
    // ===================
    // COLOR PALETTE
    // ===================
    colors: {
        // Primary gradient colors (purple to pink)
        primary: {
            purple: {
                50: '#faf5ff',
                100: '#f3e8ff',
                200: '#e9d5ff',
                300: '#d8b4fe',
                400: '#c084fc',  // Main accent
                500: '#a855f7',
                600: '#9333ea',  // Primary button
                700: '#7e22ce',
                800: '#6b21a8',
                900: '#581c87',
            },
            pink: {
                50: '#fdf2f8',
                100: '#fce7f3',
                200: '#fbcfe8',
                300: '#f9a8d4',
                400: '#f472b6',  // Main accent
                500: '#ec4899',
                600: '#db2777',  // Primary button end
                700: '#be185d',
                800: '#9d174d',
                900: '#831843',
            },
        },

        // Background colors (slate palette)
        background: {
            primary: '#0f172a',    // slate-900 - Main page background
            secondary: '#020617',  // slate-950 - Darker sections
            card: 'rgba(30, 41, 59, 0.5)',  // slate-800/50 - Card backgrounds
            cardHover: '#1e293b',  // slate-800 - Card hover state
            input: 'rgba(30, 41, 59, 0.5)',  // Input backgrounds
            overlay: 'rgba(0, 0, 0, 0.6)',   // Modal overlays
        },

        // Text colors
        text: {
            primary: '#ffffff',
            secondary: '#9ca3af',   // gray-400
            muted: '#6b7280',       // gray-500
            accent: '#c084fc',      // purple-400
        },

        // Border colors
        border: {
            default: 'rgba(255, 255, 255, 0.1)',  // white/10
            hover: 'rgba(168, 85, 247, 0.5)',     // purple-500/50
            card: 'rgba(255, 255, 255, 0.1)',
        },

        // Status colors
        status: {
            success: {
                bg: 'rgba(34, 197, 94, 0.1)',
                border: 'rgba(34, 197, 94, 0.3)',
                text: '#4ade80',  // green-400
            },
            error: {
                bg: 'rgba(239, 68, 68, 0.1)',
                border: 'rgba(239, 68, 68, 0.3)',
                text: '#f87171',  // red-400
            },
            warning: {
                bg: 'rgba(249, 115, 22, 0.1)',
                border: 'rgba(249, 115, 22, 0.3)',
                text: '#fb923c',  // orange-400
            },
            info: {
                bg: 'rgba(168, 85, 247, 0.1)',
                border: 'rgba(168, 85, 247, 0.3)',
                text: '#c084fc',  // purple-400
            },
        },
    },

    // ===================
    // GRADIENTS
    // ===================
    gradients: {
        // Primary button/accent gradient
        primary: 'linear-gradient(to right, #9333ea, #db2777)',
        primaryHover: 'linear-gradient(to right, #a855f7, #ec4899)',

        // Hero section background
        hero: 'linear-gradient(to bottom right, #581c87, #312e81, #0f172a)',
        heroOverlay: 'radial-gradient(ellipse at top right, rgba(168, 85, 247, 0.2), transparent, transparent)',

        // Text gradient
        text: 'linear-gradient(to right, #c084fc, #f472b6)',

        // Card icon gradient
        icon: 'linear-gradient(to bottom right, #a855f7, #ec4899)',

        // Tab indicator
        tabIndicator: 'linear-gradient(to right, #a855f7, #ec4899)',

        // Fade to background
        fadeToBackground: 'linear-gradient(to top, #0f172a, transparent)',
    },

    // ===================
    // TYPOGRAPHY
    // ===================
    typography: {
        fontFamily: {
            sans: 'var(--font-geist-sans), system-ui, -apple-system, sans-serif',
            mono: 'var(--font-geist-mono), ui-monospace, monospace',
        },
        fontSize: {
            xs: '0.75rem',     // 12px
            sm: '0.875rem',    // 14px
            base: '1rem',      // 16px
            lg: '1.125rem',    // 18px
            xl: '1.25rem',     // 20px
            '2xl': '1.5rem',   // 24px
            '3xl': '1.875rem', // 30px
            '4xl': '2.25rem',  // 36px
            '5xl': '3rem',     // 48px
            '6xl': '3.75rem',  // 60px
            '7xl': '4.5rem',   // 72px
        },
        fontWeight: {
            normal: '400',
            medium: '500',
            semibold: '600',
            bold: '700',
        },
        lineHeight: {
            tight: '1.25',
            normal: '1.5',
            relaxed: '1.625',
        },
    },

    // ===================
    // SPACING
    // ===================
    spacing: {
        page: {
            paddingTop: '6rem',    // pt-24 (accounts for fixed header)
            paddingBottom: '3rem', // pb-12
            paddingX: '1rem',      // px-4
        },
        section: {
            paddingY: '5rem',      // py-20
        },
        card: {
            padding: '1.25rem',    // p-5
            gap: '1.5rem',         // gap-6
        },
        container: {
            maxWidth: '80rem',     // max-w-7xl
            maxWidthNarrow: '42rem', // max-w-2xl
        },
    },

    // ===================
    // BORDER RADIUS
    // ===================
    borderRadius: {
        sm: '0.375rem',   // rounded
        md: '0.5rem',     // rounded-lg
        lg: '0.75rem',    // rounded-xl
        xl: '1rem',       // rounded-2xl
        full: '9999px',   // rounded-full
    },

    // ===================
    // SHADOWS
    // ===================
    shadows: {
        card: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
        cardHover: '0 20px 25px -5px rgba(168, 85, 247, 0.1)',
        button: '0 10px 15px -3px rgba(168, 85, 247, 0.25)',
    },

    // ===================
    // TRANSITIONS
    // ===================
    transitions: {
        default: 'all 0.3s ease',
        fast: 'all 0.15s ease',
        colors: 'color 0.2s ease, background-color 0.2s ease, border-color 0.2s ease',
    },

    // ===================
    // Z-INDEX
    // ===================
    zIndex: {
        header: 50,
        modal: 100,
        tooltip: 110,
        toast: 120,
    },
} as const;

// ===================
// TAILWIND CLASS HELPERS
// ===================

/**
 * Common Tailwind class combinations for consistent styling
 */
export const tw = {
    // Page layouts
    pageContainer: 'min-h-screen bg-slate-900 pt-24 pb-12',
    pageContainerAlt: 'min-h-screen bg-slate-950 pt-24 pb-12',
    contentWrapper: 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8',
    contentWrapperNarrow: 'max-w-2xl mx-auto px-4 sm:px-6 lg:px-8',

    // Page headers
    pageTitle: 'text-3xl font-bold text-white mb-2',
    pageSubtitle: 'text-gray-400',

    // Cards
    card: 'bg-slate-800/50 rounded-xl border border-white/10 hover:border-purple-500/50 transition-all duration-300',
    cardHover: 'hover:bg-slate-800 hover:shadow-lg hover:shadow-purple-500/10',
    cardPadding: 'p-5',

    // Buttons
    buttonPrimary: 'inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-full hover:from-purple-500 hover:to-pink-500 transition-all duration-300 shadow-lg hover:shadow-purple-500/25',
    buttonSecondary: 'inline-flex items-center justify-center px-6 py-3 text-white border-2 border-white/30 rounded-full hover:bg-white/10 transition-all duration-300',
    buttonGhost: 'px-4 py-2 text-gray-400 hover:text-white transition-colors',
    buttonDisabled: 'disabled:opacity-50 disabled:cursor-not-allowed',

    // Form inputs
    input: 'w-full px-4 py-3 bg-slate-800/50 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all',
    inputError: 'border-red-500',
    label: 'block text-sm font-medium text-gray-300 mb-2',

    // Status messages
    alertSuccess: 'p-4 bg-green-500/10 border border-green-500/30 rounded-lg',
    alertError: 'p-4 bg-red-500/10 border border-red-500/30 rounded-lg',
    alertWarning: 'p-4 bg-orange-500/10 border border-orange-500/30 rounded-lg',
    alertInfo: 'p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg',

    // Text styles
    textGradient: 'bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent',
    textMuted: 'text-gray-400',
    textAccent: 'text-purple-400',

    // Icons
    iconContainer: 'w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center text-white',
    iconContainerSmall: 'w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center',

    // Tabs
    tab: 'px-6 py-3 text-sm font-medium transition-colors relative cursor-pointer',
    tabActive: 'text-white',
    tabInactive: 'text-gray-400 hover:text-white',
    tabIndicator: 'absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-500 to-pink-500',

    // Grid layouts
    gridCols3: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6',
    gridCols4: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8',

    // Animations
    animate: {
        spin: 'animate-spin',
        pulse: 'animate-pulse',
    },

    // Skeleton loading
    skeleton: 'bg-slate-700/50 rounded animate-pulse',
} as const;

export type Theme = typeof theme;
export type TailwindHelpers = typeof tw;
