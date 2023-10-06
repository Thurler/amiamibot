class Product {
  constructor(line) {
    let splitLine = line.split(':');
    this.title = splitLine[0].slice(2).trim();
    this.link = splitLine.slice(1).join(':').trim();
    this.code = this.link.split('?')[1].trim();
  }
}

module.exports = Product;
