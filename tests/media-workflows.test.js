import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { test } from "node:test";
import Image from "@11ty/eleventy-img";

const exec = promisify(execFile);
const project = path.resolve(import.meta.dirname, "..");

test("media changes never block other artworks or leave broken feature images", async (t) => {
  await fs.mkdir(path.join(project, ".cache"), { recursive: true });
  const fixture = await fs.mkdtemp(path.join(project, ".cache/media-tests-"));
  t.after(() => fs.rm(fixture, { recursive: true, force: true }));
  await fs.cp(path.join(project, "src"), path.join(fixture, "src"), {
    recursive: true,
    filter: (source) => {
      const relative = path.relative(path.join(project, "src"), source);
      return !relative.startsWith("assets/medias/img") &&
        !/^(sculptures|paintings)\/.*\.md$/.test(relative);
    },
  });
  for (const filename of ["package.json", "eleventy.config.js"]) {
    await fs.copyFile(path.join(project, filename), path.join(fixture, filename));
  }
  await fs.symlink(path.join(project, "node_modules"), path.join(fixture, "node_modules"), "dir");
  const media = path.join(fixture, "src/assets/medias/img");
  await fs.mkdir(media, { recursive: true });
  const firstImage = await fs.readFile(path.join(project, "src/assets/medias/img/aelia.png"));
  const secondImage = await fs.readFile(path.join(project, "src/assets/medias/img/fleur.png"));
  await fs.writeFile(path.join(media, "ancienne.png"), firstImage);
  await fs.writeFile(path.join(media, "autre.png"), secondImage);
  const imagePath = (filename) => `/assets/medias/img/${filename}`;
  const writeEntry = (collection, name, image, date = "2020-01-01") => fs.writeFile(
    path.join(fixture, `src/${collection}/${name}.md`),
    `---\ntitle: ${name}\ndate: ${date}\ndimensions:\n  x: 30\n  y: 57\ntype: Sculpture\nimage: ${JSON.stringify(image)}\npermalink: false\n---\n`,
  );
  await writeEntry("sculptures", "Premiere", imagePath("ancienne.png"));
  await writeEntry("sculptures", "Seconde", imagePath("autre.png"), "2021-01-01");
  await writeEntry("paintings", "Peinture", imagePath("autre.png"));

  const html = async (file) => (await fs.readFile(path.join(fixture, "dist", file), "utf8"))
    .replace(/<!--[\s\S]*?-->/g, "");
  const names = (content) => [...content.matchAll(/<h2 class="painting--name">([^<]+)<\/h2>/g)]
    .map((match) => match[1]);
  const artworks = (content, attribute) => [...content.matchAll(new RegExp(
    `<script[^>]*${attribute}[^>]*>([\\s\\S]*?)<\\/script>`, "g",
  ))].map((match) => JSON.parse(match[1]));
  const check = async (expectedSculptures, expectedPaintings = ["Peinture"]) => {
    await exec(process.execPath, [path.join(project, "node_modules/@11ty/eleventy/cmd.cjs"), "--quiet"], {
      cwd: fixture,
    });
    const sculptures = await html("sculptures.html");
    assert.deepEqual(names(sculptures), [...expectedSculptures, ...expectedSculptures]);
    assert.deepEqual(names(await html("paintings.html")), [...expectedPaintings, ...expectedPaintings]);
    const home = await html("index.html");
    const contact = await html("contact.html");
    const merci = await html("merci/index.html");
    assert.deepEqual(artworks(contact, "data-contact-artworks")[0].map((a) => a.title), expectedSculptures);
    assert.deepEqual(artworks(home, "data-home-artworks").flat().map((a) => a.title), expectedSculptures);
    assert.deepEqual(artworks(merci, "data-home-artworks").flat().map((a) => a.title),
      [...expectedPaintings, ...expectedSculptures]);
    for (const content of [home, contact, merci, sculptures]) {
      assert.doesNotMatch(content, /<img[^>]*\bsrc=""/);
    }
    if (!expectedSculptures.length) {
      assert.doesNotMatch(home, /data-home-artwork-feature/);
      assert.doesNotMatch(contact, /data-contact-featured(?:\s|>)/);
    }
    // Hiding an artwork must never delete its editable CMS entry.
    assert.ok(await fs.stat(path.join(fixture, "src/sculptures/Premiere.md")));
    return sculptures;
  };

  await t.test("upload before selecting", async () => {
    await fs.writeFile(path.join(media, "nouvelle.png"), secondImage);
    await check(["Premiere", "Seconde"]);
  });
  await t.test("replace with uploaded image", async () => {
    await writeEntry("sculptures", "Premiere", imagePath("nouvelle.png"));
    await check(["Premiere", "Seconde"]);
  });
  await t.test("clear the image field", async () => {
    await writeEntry("sculptures", "Premiere", "");
    await check(["Seconde"]);
  });
  await t.test("reselect a previously uploaded image", async () => {
    await writeEntry("sculptures", "Premiere", imagePath("ancienne.png"));
    await check(["Premiere", "Seconde"]);
  });
  await t.test("delete selected image before replacement", async () => {
    await fs.unlink(path.join(media, "ancienne.png"));
    await check(["Seconde"]);
  });
  await t.test("select a new image after deletion", async () => {
    await writeEntry("sculptures", "Premiere", imagePath("nouvelle.png"));
    await check(["Premiere", "Seconde"]);
  });
  await t.test("delete old image after replacing it", async () => {
    await fs.writeFile(path.join(media, "ancienne.png"), firstImage);
    await fs.unlink(path.join(media, "ancienne.png"));
    await check(["Premiere", "Seconde"]);
  });
  await t.test("unreadable image hides only the affected artwork", async () => {
    await fs.writeFile(path.join(media, "invalide.png"), "not an image");
    await writeEntry("sculptures", "Premiere", imagePath("invalide.png"));
    await check(["Seconde"]);
  });
  await t.test("restore an old image and reselect it", async () => {
    await fs.writeFile(path.join(media, "ancienne.png"), firstImage);
    await writeEntry("sculptures", "Premiere", imagePath("ancienne.png"));
    await check(["Premiere", "Seconde"]);
  });
  await t.test("replace file contents without changing the filename", async () => {
    const before = await html("sculptures.html");
    await fs.writeFile(path.join(media, "ancienne.png"), secondImage);
    const after = await check(["Premiere", "Seconde"]);
    assert.notEqual(before.match(/<picture>[\s\S]*?<\/picture>/)?.[0],
      after.match(/<picture>[\s\S]*?<\/picture>/)?.[0]);
  });
  await t.test("TIFF upload uses a browser-readable image in random features", async () => {
    const metadata = await Image(firstImage, { widths: [null], formats: ["tiff"], outputDir: media });
    const filename = path.basename(metadata.tiff[0].outputPath);
    await writeEntry("sculptures", "Premiere", imagePath(filename));
    await check(["Premiere", "Seconde"]);
    for (const file of ["index.html", "contact.html", "merci/index.html"]) {
      const content = await html(file);
      for (const entry of artworks(content, file === "contact.html" ? "data-contact-artworks" : "data-home-artworks").flat()) {
        if (entry.title === "Premiere") {
          assert.match(entry.image, /^\/assets\/medias\/img\/optimized\/.*\.webp$/);
        }
      }
      assert.doesNotMatch(content, /<img[^>]*\bsrc="[^"]*\.tiff"/);
    }
  });
  await t.test("remove all sculpture images", async () => {
    await writeEntry("sculptures", "Premiere", "");
    await writeEntry("sculptures", "Seconde", null, "2021-01-01");
    await check([]);
  });
  await t.test("delete an image shared by both collections", async () => {
    await writeEntry("sculptures", "Premiere", imagePath("autre.png"));
    await fs.unlink(path.join(media, "autre.png"));
    await check([], []);
  });
  await t.test("restore shared image republishes both collections", async () => {
    await fs.writeFile(path.join(media, "autre.png"), secondImage);
    await check(["Premiere"], ["Peinture"]);
  });

  const yaml = await fs.readFile(path.join(project, "src/admin/config.yml"), "utf8");
  const imageFields = yaml.split("\n").filter((line) => /name: "image"/.test(line));
  assert.equal(imageFields.length, 2);
  assert.ok(imageFields.every((line) => /required: false/.test(line)));
});
