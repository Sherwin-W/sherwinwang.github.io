# Updating the résumé

The homepage résumé is two files in this repository. Only someone who can push to the repository and run the deploy can change them. The site has no upload form, no admin page and no API for it.

| What | File |
|---|---|
| Full PDF (opened by the viewer, the Open PDF link and Download) | `public/resume/Sherwin_Wang.pdf` |
| Preview card text (education, experience, skills) | `src/data/resume.ts` |

## Replace the PDF

1. Export the new résumé as a PDF.
2. Save it over `public/resume/Sherwin_Wang.pdf`. Keep this exact file name, because the page and any shared links point to this path.
3. Open the file and check it. It is public once deployed, including the contact details printed on it (currently a phone number and email address).

To change the file name visitors get when they press Download, edit `downloadName` in `src/data/resume.ts`.

## Update the preview card

Edit `src/data/resume.ts` so the card matches the new PDF:

- `education` and `experience`: each entry has a `title` (bold line), an `org` (second line) and a `when` (date line).
- `skills`: each key (for example `Languages`) becomes a row, and its list is shown comma-separated.

The card is a short preview, so keep it to the headline entries. The PDF holds the detail.

## Check and publish

```sh
npm run dev           # check the card and press "Learn more" to see the new PDF
npm run lint && npm run typecheck && npm test && npm run build
git add public/resume/Sherwin_Wang.pdf src/data/resume.ts
git commit -m "Update résumé"
git push origin main
npm run deploy        # publishes to GitHub Pages
```

Browsers may cache the old PDF for a short time after a deploy, so a hard refresh may be needed to see the new one.
