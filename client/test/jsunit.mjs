import { queueWork } from '../../YeldingExecutor.js'

export function assertTrue(bool) {
  if (!bool) {
    throw `ASSERTION_ERROR: should have been true`
  }
}

export function assertEquals(expected, actual) {
  if (expected !== actual) {
    throw `ASSERTION_ERROR: expected:${expected} actual:${actual}`
  }
}

export function assertNotEquals(expected, actual) {
  if (expected === actual) {
    throw `ASSERTION_ERROR: expected:${expected} should not be equal to actual:${actual}`
  }
}

export class TestRunner {
  passed = 0 
  failed = 0

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

  runOneTest (methodName, context) {
    let method = context[methodName]
    context.beforeEach()
    try {
      method();
      context.passed++;
      console.log(`PASSED: ${methodName}`)  
    } catch (e){
      console.error(`FAILED: ${methodName}`)
      console.error(e)
      context.failed++;
    }
    context.afterEach()
  }

  report () {
    let status = 'SUCCESS'
    if (this.failed > 0) {
      status = 'FAILURE'
    }
    alert(`${status} Passed:${this.passed} Failed:${this.failed}`)
    
    if (this.afterTests) {
      this.afterTests();
    }
  }

  run () {
    let tests = this.getAllFuncs(this);
    for (const method of tests) {
      queueWork(this.runOneTest, this, [method, this])
    }
    queueWork(this.report, this)
  }
}