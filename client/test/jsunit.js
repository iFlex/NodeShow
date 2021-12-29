export function assertTrue(bool) {
  if (!bool) {
    throw `ASSERTION_ERROR: should have been true`
  }
}

export function assertEquals(expected, actual) {
  if (!(expected === actual)) {
    throw `ASSERTION_ERROR: expected: ${expected} actual:${actual}`
  }
}

export class TestRunner {
  constructor () {

  }

  beforeEach () {
    let item = document.createElement("DIV")
    item.id = '1'
    document.body.appendChild(item)
  }

  afterEach () {
    this.cleanPage ();
  }

  cleanPage () {
    let toDel = []
    for (const child of document.body.childNodes) {
      toDel.push(child)
    }

    for (const child of toDel) {
      child.parentNode.removeChild(child)
    }
  }

  getAllFuncs(toCheck) {
    const props = [];
    let obj = toCheck;
    do {
        props.push(...Object.getOwnPropertyNames(obj));
    } while (obj = Object.getPrototypeOf(obj));
    
    return props.sort().filter((e, i, arr) => { 
       if (e!=arr[i+1] && typeof toCheck[e] == 'function' && e.includes('test')) return true;
    });
  }

  run () {
    let tests = this.getAllFuncs(this);
    for (const method of tests) {
      this.beforeEach()
      try {
        this[method]();
        console.log(`PASSED: ${method}`)  
      } catch (e){
        console.error(`FAILED: ${method}`)
        console.error(e)
      }
      this.afterEach();
    }
  }
}