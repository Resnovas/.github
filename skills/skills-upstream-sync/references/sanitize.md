# Sanitize published skill text

Before every PostHog create/update:

1. Replace Unicode em dash (U+2014) and en dash (U+2013) with ASCII hyphen-minus `-`.
2. Do not rewrite binary assets, LICENSE texts, or intentional Unicode in customer data (skills should not contain those).
3. Do not "fix" markdown table separator rows (pipes and hyphens).
4. Scan the final body and each file content once before calling PostHog.