# AVELI Fashion Site

Minimal fashion storefront + password-protected admin upload panel.

## Run

```bash
npm install
ADMIN_PASSWORD='Alyx1017!' SESSION_SECRET='your-secret' npm start
```

Open:
- `http://localhost:3000/` for the storefront
- `http://localhost:3000/admin` for admin uploads

## Notes

- Uploaded files are stored in:
  - `uploads/media`
  - `uploads/music`
- Allowed media: jpg, jpeg, png, webp, gif, mp4, mov, webm
- Allowed music: mp3, wav, m4a, aac, ogg
