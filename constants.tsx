
// FIX: Added React import to resolve "Cannot find namespace 'React'" error.
import React from 'react';

export type IconProps = React.SVGProps<SVGSVGElement>;

// Helper to wrap SVG paths in a standard Heroicon-style SVG container
const IconWrapper = ({ children, ...props }: { children: React.ReactNode } & IconProps) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        {children}
    </svg>
);

// FIX: Exporting all icons required by App.tsx, layouts, and views.
export const SunIcon = (props: IconProps) => (
    <IconWrapper {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.25-1.591 1.591M5.25 12H3m4.25-4.773L5.659 5.659M12 7.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9Z" />
    </IconWrapper>
);

export const MoonIcon = (props: IconProps) => (
    <IconWrapper {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
    </IconWrapper>
);

export const SettingsIcon = (props: IconProps) => (
    <IconWrapper {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 0 0-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 0 0-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 0 0-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 0 0-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 0 0 1.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065Z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
    </IconWrapper>
);

export const LogoutIcon = (props: IconProps) => (
    <IconWrapper {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
    </IconWrapper>
);

export const CheckIcon = (props: IconProps) => (
    <IconWrapper {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
    </IconWrapper>
);

export const XMarkIcon = (props: IconProps) => (
    <IconWrapper {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </IconWrapper>
);

export const QuestionMarkCircleIcon = (props: IconProps) => (
    <IconWrapper {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
    </IconWrapper>
);

export const SparklesIcon = (props: IconProps) => (
    <IconWrapper {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
    </IconWrapper>
);

export const CheckBadgeIcon = (props: IconProps) => (
    <IconWrapper {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.746 3.746 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z" />
    </IconWrapper>
);

export const MenuIcon = (props: IconProps) => (
    <IconWrapper {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
    </IconWrapper>
);

export const UsersIcon = (props: IconProps) => (
    <IconWrapper {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-3.833-6.249c-.184 0-.366.022-.539.063a1.535 1.535 0 0 1-.411-.849 8.974 8.974 0 0 0-3.414-5.291 3.75 3.75 0 0 0-4.692 0 8.974 8.974 0 0 0-3.414 5.291 1.535 1.535 0 0 1-.411.849c-.173-.041-.355-.063-.539-.063a4.125 4.125 0 0 0-3.833 6.249 9.337 9.337 0 0 0 4.121.952 9.38 9.38 0 0 0 2.625-.372M9 7.5a3 3 0 1 1 6 0 3 3 0 0 1-6 0Zm3 9a3 3 0 1 1 6 0 3 3 0 0 1-6 0Z" />
    </IconWrapper>
);

export const RouteIcon = (props: IconProps) => (
    <IconWrapper {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503-3.46c.495.301.883.695 1.138 1.139a9.031 9.031 0 0 1-1.505 1.01c-.712.422-1.564.661-2.47.661-.906 0-1.758-.239-2.47-.661a9.04 9.04 0 0 1-1.505-1.01 2.257 2.257 0 0 0 1.138-1.14c.255-.443.643-.837 1.138-1.138.495-.301.883-.695 1.138-1.139a9.033 9.033 0 0 1-1.505-1.01A4.412 4.412 0 0 0 12 7.5c-.906 0-1.758.239-2.47.661a9.041 9.041 0 0 1-1.505 1.01c.495.302.883.696 1.138 1.14.255.443.643.837 1.138 1.138Z" />
    </IconWrapper>
);

export const StoreIcon = (props: IconProps) => (
    <IconWrapper {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007ZM8.625 10.5a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm7.5 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
    </IconWrapper>
);

export const ChartBarIcon = (props: IconProps) => (
    <IconWrapper {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
    </IconWrapper>
);

export const DownloadIcon = (props: IconProps) => (
    <IconWrapper {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </IconWrapper>
);

export const CalendarDaysIcon = (props: IconProps) => (
    <IconWrapper {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5m-13.5-6h.008v.008H7.5v-.008Zm0 3h.008v.008H7.5v-.008Zm3-3h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Zm3-3h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Zm3-3h.008v.008H16.5v-.008Zm0 3h.008v.008H16.5v-.008Z" />
    </IconWrapper>
);

export const ArchiveBoxIcon = (props: IconProps) => (
    <IconWrapper {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 4.5A.75.75 0 0 1 3 3.75h18a.75.75 0 0 1 .75.75v3a.75.75 0 0 1-.75.75H3a.75.75 0 0 1-.75-.75v-3ZM3.75 9.75a.75.75 0 0 1 .75.75v6.75h15V10.5a.75.75 0 0 1 1.5 0v7.5a.75.75 0 0 1-.75.75H3.75a.75.75 0 0 1-.75-.75v-7.5a.75.75 0 0 1 .75-.75Z M9.75 12h4.5a.75.75 0 0 1 0 1.5h-4.5a.75.75 0 0 1 0-1.5Z" />
    </IconWrapper>
);

export const ExclamationTriangleIcon = (props: IconProps) => (
    <IconWrapper {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
    </IconWrapper>
);

export const DashboardIcon = (props: IconProps) => (
    <IconWrapper {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75h6.75v6.75H3.75V3.75Zm9 0h6.75v6.75h-6.75V3.75Zm-9 9h6.75v6.75H3.75v-6.75Zm9 0h6.75v6.75h-6.75v-6.75Z" />
    </IconWrapper>
);

export const WeatherCloudyIcon = (props: IconProps) => (
    <IconWrapper {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15a4.5 4.5 0 0 0 4.5 4.5H18a3.75 3.75 0 0 0 1.132-7.33 4.5 4.5 0 0 0-8.846-1.17 4.5 4.5 0 0 0-8.036 3.5V15Z" />
    </IconWrapper>
);

export const WeatherSunnyIcon = (props: IconProps) => (
    <SunIcon {...props} />
);

export const CloudRainIcon = (props: IconProps) => (
    <IconWrapper {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15a4.5 4.5 0 0 0 4.5 4.5H18a3.75 3.75 0 0 0 1.132-7.33 4.5 4.5 0 0 0-8.846-1.17 4.5 4.5 0 0 0-8.036 3.5V15ZM9 20.25l-.75 2.25M12 20.25l-.75 2.25M15 20.25l-.75 2.25" />
    </IconWrapper>
);

export const EditIcon = (props: IconProps) => (
    <IconWrapper {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
    </IconWrapper>
);

export const TrashIcon = (props: IconProps) => (
    <IconWrapper {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.34 9m-4.78 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.166L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
    </IconWrapper>
);

export const PlusIcon = (props: IconProps) => (
    <IconWrapper {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </IconWrapper>
);

export const CurrencyDollarIcon = (props: IconProps) => (
    <IconWrapper {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </IconWrapper>
);

export const ShoppingCartIcon = (props: IconProps) => (
    <IconWrapper {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 2.25h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
    </IconWrapper>
);

export const CopyIcon = (props: IconProps) => (
    <IconWrapper {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75M19.5 8.25v10.5A2.25 2.25 0 0 1 17.25 21h-7.5a2.25 2.25 0 0 1-2.25-2.25V8.25a2.25 2.25 0 0 1 2.25-2.25h7.5a2.25 2.25 0 0 1 2.25 2.25Z" />
    </IconWrapper>
);

export const MegaphoneIcon = (props: IconProps) => (
    <IconWrapper {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.017.505.03.758.038.503.015 1.006.015 1.509.015H15a2.25 2.25 0 002.25-2.25V8.25A2.25 2.25 0 0015 6h-2.303c-.503 0-1.006 0-1.509.015a11.05 11.05 0 00-.758.038m0 9.18c.35.023.702.043 1.056.062a4.48 4.48 0 011.056.062m-2.112 0v-.917m0 .917v.458m10.124-7.545a3.375 3.375 0 0 1 0 4.75m-3.182-3.966a1.5 1.5 0 0 1 0 3.182" />
    </IconWrapper>
);

export const LOGO_ICON_LIST = {
    SunIcon,
    MoonIcon,
    SettingsIcon,
    SparklesIcon,
    CheckBadgeIcon,
    UsersIcon,
    RouteIcon,
    StoreIcon,
    ArchiveBoxIcon,
    CurrencyDollarIcon,
    MegaphoneIcon
};
