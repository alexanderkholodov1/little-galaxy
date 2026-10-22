# Self-hosted finding-chart fonts

Spectral 400 is the display face; Archivo Narrow 400 and 700 are the text and label faces. Sources: npm @fontsource/spectral 5.3.0 and @fontsource/archivo-narrow 5.3.0. Designers: Production Type (Spectral) and Omnibus-Type (Archivo Narrow). Both are licensed under the **SIL Open Font License 1.1**; see OFL-Spectral.txt and OFL-ArchivoNarrow.txt.

The supplied WOFF2 files contain latin and latin-ext subsets, declared with their Google Fonts unicode ranges and font-display: swap. Font binaries have not been changed. Georgia and Trebuchet MS remain later fallbacks.

Printed observatory finding charts set the chart title in a transitional old-style serif and the coordinates, magnitudes and marginal notes in a narrow grotesque. Spectral carries the title and Archivo Narrow carries the compact labels; its tabular figures and narrow proportions fit a 375 px phone. Compared numbers use font-variant-numeric: tabular-nums.

SHA256 computed from the supplied files with Node crypto:

| File | SHA256 |
| --- | --- |
| spectral-latin-400.woff2 | cf8daee3b83c1e662196c6e34e444bc41344d54bfeb4fb5351e197de6ce94539 |
| spectral-latin-ext-400.woff2 | fc4b2566ccd9714a72c2137f822311cb0131296c83c8ee93848ae6f887969e85 |
| archivo-narrow-latin-400.woff2 | 50e835187413b9d25833ccd7c9638673e64112aafd64004f48fc613ace27e354 |
| archivo-narrow-latin-ext-400.woff2 | e34541922a09e3477853bc33465deb78be88f696e635f36c3a06d53e4f39bf7e |
| archivo-narrow-latin-700.woff2 | 062eae97e718b8a39ff5861d08046755eaf4c6f27f9a0fe861116d9d1305d6bf |
| archivo-narrow-latin-ext-700.woff2 | 146b1f02c8b3ab29b767569524edcb5a83929212bbda070c0b8b7ab770e50c9a |
