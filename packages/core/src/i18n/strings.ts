export const strings = {
  en: { login: 'Log in', phone: 'Phone number', password: 'Password', available: 'Available',
        offline: 'You are offline', retry: 'Retry', restaurants: 'Restaurants' },
  bn: { login: 'লগ ইন', phone: 'ফোন নম্বর', password: 'পাসওয়ার্ড', available: 'উপলব্ধ',
        offline: 'আপনি অফলাইন', retry: 'আবার চেষ্টা', restaurants: 'রেস্তোরাঁ' },
} as const;
export type StringKey = keyof typeof strings['en'];
