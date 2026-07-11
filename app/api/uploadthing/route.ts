import { createRouteHandler } from "uploadthing/next"
import { ourFileRouter } from "./core"

// Reuse the AfroTransact UploadThing app token (same as the storefront UI).
// Pass it explicitly rather than relying on the implicit env read — this is
// the exact config the storefront uses and is known to work. Set
// UPLOADTHING_TOKEN in .env.local (and Vercel). UPLOADTHING_CALLBACK_URL is
// optional; when unset the SDK infers the callback from the request origin.
const callbackUrl = process.env.UPLOADTHING_CALLBACK_URL?.trim()

export const { GET, POST } = createRouteHandler({
  router: ourFileRouter,
  config: {
    token: process.env.UPLOADTHING_TOKEN,
    ...(callbackUrl ? { callbackUrl } : {}),
  },
})
