import { Container } from "../Container.js";
import "../container.serialization.js"
import "../container.positioning.js";
import "../container.staticcontent.js";
import "../container.actions.js";
import "../container.summarize.js";

let container = new Container(document.body, false);
container.init();
export { container as container }