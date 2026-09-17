const DYNAMIC_CONTENT_SELECTOR = ".dynamic-content";
const DYNAMIC_GALLERY_SELECTOR = "dynamic-gallery";

export const FANCYBOX_IMAGE_SELECTOR: string = [
	`.custom-md img:not(.card-wiki-link img):not(${DYNAMIC_CONTENT_SELECTOR} img):not(${DYNAMIC_GALLERY_SELECTOR} img)`,
	"#post-cover img",
	".moment-images img",
].join(", ");

export const FANCYBOX_LINK_SELECTOR: string = [
	".moment-images a[data-fancybox]",
	`[data-fancybox]:not(.moment-images a):not(${DYNAMIC_GALLERY_SELECTOR} [data-gallery-lightbox])`,
].join(", ");
