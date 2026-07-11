import {
  generateUploadDropzone,
  generateUploadButton,
  generateReactHelpers,
} from "@uploadthing/react"
import type { OurFileRouter } from "@/app/api/uploadthing/core"

export const UploadDropzone = generateUploadDropzone<OurFileRouter>()
export const UploadButton = generateUploadButton<OurFileRouter>()

// Manual hook — this is the pattern the AfroTransact storefront uses
// successfully for every upload (startUpload + a plain file input), rather
// than the <UploadDropzone> component.
export const { useUploadThing } = generateReactHelpers<OurFileRouter>()
