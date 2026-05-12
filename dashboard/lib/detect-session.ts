export type SessionType = "reel" | "carousel" | "post";

export interface SessionInfo {
  type: SessionType;
  files: {
    video?: string;
    slides?: string[];
    image?: string;
    imageInstagram?: string;
    imageLinkedin?: string;
    caption?: string;
    postMd?: string;
  };
  hasLinkedin: boolean;
  hasInstagram: boolean;
}

export function detectSession(
  fileNames: string[]
): SessionInfo | null {
  const names = new Set(fileNames);

  if (names.has("final.mp4")) {
    return {
      type: "reel",
      files: {
        video: "final.mp4",
        caption: names.has("caption.md") ? "caption.md" : undefined,
      },
      hasLinkedin: false,
      hasInstagram: true,
    };
  }

  if (names.has("1.png") && names.has("2.png")) {
    const slides: string[] = [];
    let i = 1;
    while (names.has(`${i}.png`)) {
      slides.push(`${i}.png`);
      i++;
    }
    return {
      type: "carousel",
      files: {
        slides,
        caption: names.has("caption.txt") ? "caption.txt" : undefined,
      },
      hasLinkedin: false,
      hasInstagram: true,
    };
  }

  const hasIgImage = names.has("image-instagram.png");
  const hasLiImage = names.has("image-linkedin.png");
  const hasGenericImage = names.has("image.png");

  if (hasIgImage || hasLiImage || hasGenericImage) {
    return {
      type: "post",
      files: {
        image: hasGenericImage ? "image.png" : undefined,
        imageInstagram: hasIgImage ? "image-instagram.png" : undefined,
        imageLinkedin: hasLiImage ? "image-linkedin.png" : undefined,
        postMd: names.has("post.md") ? "post.md" : undefined,
      },
      hasLinkedin: hasLiImage,
      hasInstagram: hasIgImage || hasGenericImage,
    };
  }

  return null;
}
