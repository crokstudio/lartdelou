const parseArtworkData = (element) => {
  if (!element) {
    return [];
  }

  try {
    const artworks = JSON.parse(element.textContent || "[]");
    return Array.isArray(artworks) ? artworks.filter((artwork) => artwork.image) : [];
  } catch {
    return [];
  }
};

const getRandomArtwork = (artworks) => {
  return artworks[Math.floor(Math.random() * artworks.length)];
};

const setArtworkText = (container, selector, value) => {
  const element = container.querySelector(selector);

  if (element && value !== undefined && value !== null) {
    element.textContent = value;
  }
};

const contactFeatured = document.querySelector("[data-contact-featured]");
const contactArtworksData = document.querySelector("[data-contact-artworks]");

if (contactFeatured && contactArtworksData) {
  const artwork = getRandomArtwork(parseArtworkData(contactArtworksData));
  const image = contactFeatured.querySelector("[data-contact-featured-image]");

  if (artwork && image) {
    image.src = artwork.image;
    image.alt = artwork.title || "";

    setArtworkText(contactFeatured, "[data-contact-featured-title]", artwork.title);
    setArtworkText(contactFeatured, "[data-contact-featured-year]", artwork.year);
    setArtworkText(contactFeatured, "[data-contact-featured-type]", artwork.type);
    setArtworkText(contactFeatured, "[data-contact-featured-dimensions]", artwork.dimensions);
  }
}

document.querySelectorAll("[data-home-artwork-feature]").forEach((feature) => {
  const artwork = getRandomArtwork(parseArtworkData(feature.querySelector("[data-home-artworks]")));
  const image = feature.querySelector("[data-home-artwork-image]");

  if (artwork && image) {
    image.src = artwork.image;
    image.alt = artwork.title || "";

    setArtworkText(feature, "[data-home-artwork-title]", artwork.title);
    setArtworkText(feature, "[data-home-artwork-year]", artwork.year);
  }
});

const paintingsList = document.querySelector("[data-paintings-list]");
const supportsDesktopCarousel = window.matchMedia("(min-width: 1024px)");

if (paintingsList && supportsDesktopCarousel.matches) {
  const sets = Array.from(paintingsList.querySelectorAll("[data-paintings-set]"));
  const viewport = paintingsList.closest(".paintings");
  const items = Array.from(paintingsList.querySelectorAll(".paintings--item"));
  let activeItem = items[0];

  const getImageRatio = (item) => {
    const image = item.querySelector("img");
    const width = Number(image?.getAttribute("width")) || image?.naturalWidth || 1;
    const height = Number(image?.getAttribute("height")) || image?.naturalHeight || 1;

    return width / height;
  };

  const getBaseHeight = () => {
    return parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--image-height")) || 360;
  };

  const getItemGap = () => {
    return parseFloat(getComputedStyle(sets[0]).columnGap) || 0;
  };

  const getActiveSize = (ratio) => {
    const maxHeight = paintingsList.clientHeight || viewport.clientHeight || getBaseHeight();
    const maxWidth = viewport.clientWidth * 0.7;
    const widthFromHeight = maxHeight * ratio;

    if (widthFromHeight <= maxWidth) {
      return {
        width: widthFromHeight,
        height: maxHeight,
      };
    }

    return {
      width: maxWidth,
      height: maxWidth / ratio,
    };
  };

  const updateSizes = () => {
    const baseHeight = getBaseHeight();

    items.forEach((item) => {
      const ratio = getImageRatio(item);
      const activeSize = getActiveSize(ratio);

      item.style.setProperty("--image-width", `${baseHeight * ratio}px`);
      item.style.setProperty("--image-width-active", `${activeSize.width}px`);
      item.style.setProperty("--image-height-active", `${activeSize.height}px`);
    });
  };

  const getTargetCenter = (item) => {
    const gap = getItemGap();
    const baseHeight = getBaseHeight();
    let center = 0;

    for (const painting of paintingsList.querySelectorAll(".paintings--item")) {
      const ratio = getImageRatio(painting);
      const width = painting === item ? getActiveSize(ratio).width : baseHeight * ratio;

      if (painting === item) {
        return center + width / 2;
      }

      center += width + gap;
    }

    return 0;
  };

  const setActiveItem = (item) => {
    activeItem = item;
    updateSizes();

    items.forEach((painting) => {
      painting.classList.toggle("active", painting === item);
    });
  };

  const updateTransform = (item) => {
    const itemCenter = getTargetCenter(item);
    const viewportCenter = viewport.clientWidth / 2;

    paintingsList.style.transform = `translateX(${viewportCenter - itemCenter}px)`;
  };

  const normalizeSets = () => {
    const activeSet = activeItem.closest("[data-paintings-set]");
    const otherSet = sets.find((set) => set !== activeSet);
    const activeIndex = Number(activeItem.dataset.index);
    const placeOtherBefore = activeIndex < activeSet.children.length / 2;

    paintingsList.classList.add("is-resetting");

    if (placeOtherBefore && paintingsList.firstElementChild !== otherSet) {
      paintingsList.insertBefore(otherSet, activeSet);
    }

    if (!placeOtherBefore && paintingsList.lastElementChild !== otherSet) {
      paintingsList.append(otherSet);
    }

    setActiveItem(activeItem);
    updateTransform(activeItem);
    paintingsList.offsetHeight;
    paintingsList.classList.remove("is-resetting");
  };

  const centerItem = (item) => {
    setActiveItem(item);
    updateTransform(item);
  };

  items.forEach((item) => {
    item.addEventListener("click", () => centerItem(item));
  });

  paintingsList.addEventListener("transitionend", (event) => {
    if (event.target !== paintingsList || event.propertyName !== "transform") {
      return;
    }

    normalizeSets();
  });

  window.addEventListener("resize", () => {
    if (activeItem) {
      setActiveItem(activeItem);
      updateTransform(activeItem);
    }
  });

  if (activeItem) {
    normalizeSets();
  }
}
