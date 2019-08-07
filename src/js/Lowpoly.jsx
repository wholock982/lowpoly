import { drawImageProp, PRNG } from './common/helpers';
import { hslToCss, getRandomHex } from './common/colour';
import Triangle from './Triangle';

export default class Lowpoly {
  constructor(element) {
    this.element = element;
    this.ctx = this.element.getContext('2d');
    this.points = [];
    this.triangles = [];

    // options
    this.variance = 4;
    this.cellSize = 50;
    this.depth = 0;
    this.image = null;
    this.colours = [];
    this.useImage = false;


    this.gridWidth = 0;
    this.gridHeight = 0;

    this.columnCount = 0;
    this.rowCount = 0;
  }

  drawTriangle(vertices) {
    this.ctx.beginPath();
    this.ctx.moveTo(vertices[0].x, vertices[0].y);
    this.ctx.lineTo(vertices[1].x, vertices[1].y);
    this.ctx.lineTo(vertices[2].x, vertices[2].y);
    this.ctx.closePath();
    this.ctx.fill();
  }

  drawBackground() {
    const { ctx, element, colours } = this;

    ctx.clearRect(0, 0, element.width, element.height);

    // using an image
    if (this.image && this.useImage) {
      const baseImage = new Image();
      baseImage.crossOrigin = 'Anonymous';
      baseImage.src = this.image;

      return new Promise((resolve) => {
        baseImage.onload = () => {
          // use image instead of gradient
          // drawImageProp simulates background-size: cover
          drawImageProp(ctx, baseImage);
          resolve();
        };
      });
    }
    // using a gradient
    ctx.globalCompositeOperation = 'multiply';

    // loop colours and create gradient
    let gradient = ctx.createLinearGradient(0, 0, element.width, element.height);
    for (let i = 0; i < colours.length; i++) {
      if (colours.length > 1) {
        gradient.addColorStop(
          i / (colours.length - 1),
          hslToCss(...colours[i]),
        );
      } else {
        gradient = colours[i];
      }
    }

    // draw gradient on element
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.fillRect(0, 0, element.width, element.height);
    ctx.closePath();
    ctx.fill();

    // draw gradient overlay
    const overlay = ctx.createLinearGradient(0, 0, 0, element.height);
    overlay.addColorStop(0, '#fff');
    overlay.addColorStop(1, '#ccc');

    ctx.beginPath();
    ctx.fillStyle = overlay;
    ctx.fillRect(0, 0, element.width, element.height);
    ctx.closePath();
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    return new Promise((resolve) => {
      resolve();
    });
  }

  // generate a grid of point objects
  generatePoints() {
    const {
      rowCount, columnCount, cellSize, variance,
    } = this;
    const ret = [];

    const random = new PRNG(0);

    for (let i = 0; i < rowCount; i++) {
      for (let j = 0; j < columnCount; j++) {
        const temp = {};
        // get y position and add variance
        temp.y = (i * cellSize * 0.866) - cellSize;
        temp.y += (random.generate() - 0.5) * variance * cellSize * 2;
        // even rows
        if (i % 2 === 0) {
          temp.x = (j * cellSize) - cellSize;
          temp.x += (random.generate() - 0.5) * variance * cellSize * 2;
        } else {
          // odd rows
          temp.x = (j * cellSize) - cellSize + (cellSize / 2);
          temp.x += (random.generate() - 0.5) * variance * cellSize * 2;
        }

        ret.push(temp);
      }
    }
    // console.log(ret);
    this.points = ret;
  }

  generateTriangles() {
    const { points, rowCount, columnCount } = this;

    const ret = [];
    // console.log(points);

    for (let i = 0; i < points.length; i++) {
      const currentRow = Math.floor(i / columnCount);

      // don't add squares/triangles to the end of a row
      if (i % columnCount !== columnCount - 1 && i < ((rowCount - 1) * columnCount)) {
        const square = [
          points[i],
          points[i + 1],
          points[columnCount + i + 1],
          points[columnCount + i],
        ];

        let tri1;
        let tri2;

        // create two triangles from the square;
        if (currentRow % 2 !== 0) {
          tri1 = new Triangle([square[0], square[2], square[3]]);
          tri2 = new Triangle([square[0], square[1], square[2]]);
        } else {
          tri1 = new Triangle([square[0], square[1], square[3]]);
          tri2 = new Triangle([square[1], square[2], square[3]]);
        }

        ret.push(tri1, tri2);
      }
    }

    // console.log(ret);

    this.triangles = ret;
  }

  drawCell(cell) {
    const { element, ctx, depth } = this;
    const centre = cell.getCentre();

    // console.log(cell);

    // boundaries
    if (centre.x < 0) centre.x = 0;
    if (centre.x > element.width - 1) centre.x = element.width - 1;
    if (centre.y < 0) centre.y = 0;
    if (centre.y > element.height - 1) centre.y = element.height - 1;

    const pixel = (Math.floor(centre.x) + (Math.floor(centre.y) * element.width)) * 4;

    // const [red, green, blue, alpha] = ctx.getImageData(centre.x, centre.y, 1, 1).data;
    const [red, green, blue, alpha] = [
      this.imageData[pixel],
      this.imageData[pixel + 1],
      this.imageData[pixel + 2],
      this.imageData[pixel + 3],
    ];

    const temp = (Math.random() * 2 * depth) - depth;
    ctx.fillStyle = `rgba(
      ${Math.round(red - red * temp)},
      ${Math.round(green - green * temp)},
      ${Math.round(blue - blue * temp)},
      ${alpha / 255}
    )`;
    // ctx.fillStyle = getRandomHex();

    this.drawTriangle(cell.vertices);
  }

  async render(options, callback) {
    Object.assign(this, options);
    let t0;
    let t1;

    this.cellSize = (this.cellSize * 3) + 30;
    this.variance = this.variance / 100;
    this.depth = this.depth / 200;

    this.gridWidth = this.element.width + this.cellSize * 2;
    this.gridHeight = this.element.height + this.cellSize * 2;

    this.columnCount = Math.ceil(this.gridWidth / this.cellSize) + 2;
    this.rowCount = Math.ceil(this.gridHeight / (this.cellSize * 0.865));

    t0 = performance.now();
    this.generatePoints();
    t1 = performance.now();
    console.log(`generatePoints: ${t1 - t0} ms`);

    // console.log(this.points);
    t0 = performance.now();
    this.generateTriangles();
    t1 = performance.now();
    console.log(`generateTriangles: ${t1 - t0} ms`);

    const { element, ctx, triangles } = this;

    // clear canvases
    ctx.clearRect(0, 0, element.width, element.height);

    t0 = performance.now();
    await this.drawBackground();
    t1 = performance.now();
    console.log(`drawBackground: ${t1 - t0} ms`);

    t0 = performance.now();
    this.imageData = ctx.getImageData(0, 0, element.width, element.height).data;
    t1 = performance.now();
    console.log(`getImageData: ${t1 - t0} ms`);

    // console.log(this);

    // draw polygons on main canvas
    // console.log(triangles);
    t0 = performance.now();
    for (let i = 0; i < triangles.length; i++) {
      this.drawCell(triangles[i]);
    }
    t1 = performance.now();
    console.log(`drawCell: ${t1 - t0} ms`);

    // generate data url of image
    this.dataUrl = element.toDataURL();

    if (callback) {
      callback();
    }
  }
}
