import assert from 'assert';
import { expect } from 'chai';
import { InputAccessManager, ACCESS_REQUIREMENT } from '../components/utils/InputAccessManager.mjs';

function sleep(milliseconds) {
  const date = Date.now();
  let currentDate = null;
  do {
    currentDate = Date.now();
  } while (currentDate - date < milliseconds);
}

describe('InputAccessManager', function() {
  let iam = null;
  
  beforeEach(function() {
    iam = new InputAccessManager();
  })
  
  it('default access grants access to all', function() {
    iam.register('event','listener1')
    iam.register('event','listener2', ACCESS_REQUIREMENT.DEFAULT)
    iam.register('event','listener3')

    let allowed = iam.getAllowed('event')
    expect(allowed.length).to.equal(3);

    iam.unregister('event','listener3')
    allowed = iam.getAllowed('event')
    expect(allowed.length).to.equal(2);    
  })

  it('setExclusive + default grants to all default and one setExclusive', function() {
    iam.register('event','listener1')
    iam.register('event','listener2')
    iam.register('event','listener3', ACCESS_REQUIREMENT.SET_EXCLUSIVE);sleep(2);
    iam.register('event','listener4', ACCESS_REQUIREMENT.SET_EXCLUSIVE);sleep(2);
    iam.register('event','listener5', ACCESS_REQUIREMENT.SET_EXCLUSIVE);sleep(2);
    iam.register('event','listener6')

    let allowed = iam.getAllowed('event')
    expect(allowed.length).to.equal(4);
    expect(allowed).to.deep.equal(['listener1','listener2','listener6','listener5'])    
  })

  it('setInclusive takes precedence over setExclusive and default', function() {
    iam.register('event','listener1', ACCESS_REQUIREMENT.SET_INCLUSIVE)
    iam.register('event','listener2', ACCESS_REQUIREMENT.SET_INCLUSIVE)
    iam.register('event','listener3')
    iam.register('event','listener4', ACCESS_REQUIREMENT.SET_EXCLUSIVE);sleep(2);
    iam.register('event','listener5', ACCESS_REQUIREMENT.SET_EXCLUSIVE);sleep(2);
    iam.register('event','listener6', ACCESS_REQUIREMENT.SET_EXCLUSIVE);sleep(2);
    iam.register('event','listener7')
    iam.register('event','listener8')

    let allowed = iam.getAllowed('event')
    expect(allowed.length).to.equal(2);
    expect(allowed).to.deep.equal(['listener1','listener2'])    
  })

  it('exclusive takes precedence over everything else', function() {
    iam.register('event','listener1', ACCESS_REQUIREMENT.SET_INCLUSIVE)
    iam.register('event','listener2', ACCESS_REQUIREMENT.SET_INCLUSIVE)
    iam.register('event','listener3', ACCESS_REQUIREMENT.EXCLUSIVE);sleep(2);
    iam.register('event','listener4', ACCESS_REQUIREMENT.SET_EXCLUSIVE);sleep(2);
    iam.register('event','listener5', ACCESS_REQUIREMENT.SET_EXCLUSIVE);sleep(2);
    iam.register('event','listener6', ACCESS_REQUIREMENT.SET_EXCLUSIVE);sleep(2);
    iam.register('event','listener7')
    iam.register('event','listener8')

    let allowed = iam.getAllowed('event')
    expect(allowed.length).to.equal(1);
    expect(allowed).to.deep.equal(['listener3'])    
  })

  it('register / unregister respects register order', function() {
    iam.register('event','listener1', ACCESS_REQUIREMENT.EXCLUSIVE);sleep(2);
    iam.register('event','listener2', ACCESS_REQUIREMENT.EXCLUSIVE);sleep(2);
    iam.register('event','listener3', ACCESS_REQUIREMENT.EXCLUSIVE);sleep(2);
    iam.register('event','listener4', ACCESS_REQUIREMENT.EXCLUSIVE);sleep(2);
    iam.register('event','listener5', ACCESS_REQUIREMENT.SET_EXCLUSIVE);sleep(2);
    iam.register('event','listener6', ACCESS_REQUIREMENT.SET_EXCLUSIVE);sleep(2);
    iam.register('event','listener7', ACCESS_REQUIREMENT.SET_EXCLUSIVE);sleep(2);

    expect(iam.getAllowed('event')).to.deep.equal(['listener4'])
    iam.unregister('event','listener3')
    expect(iam.getAllowed('event')).to.deep.equal(['listener4'])
    iam.unregister('event','listener4')
    expect(iam.getAllowed('event')).to.deep.equal(['listener2'])
    iam.unregister('event','listener2')
    expect(iam.getAllowed('event')).to.deep.equal(['listener1'])
    iam.unregister('event','listener1')
    expect(iam.getAllowed('event')).to.deep.equal(['listener7'])
    iam.unregister('event','listener7')
    expect(iam.getAllowed('event')).to.deep.equal(['listener6'])
    iam.unregister('event','listener6')
    expect(iam.getAllowed('event')).to.deep.equal(['listener5'])
    iam.unregister('event','listener5')
  })  

  it('unregister grants to the correct remaining acces_requirement', function() {
    // iam.register('event','listener1', ACCESS_REQUIREMENT.SET_INCLUSIVE)
    // iam.register('event','listener2', ACCESS_REQUIREMENT.SET_INCLUSIVE)
    // iam.register('event','listener3', ACCESS_REQUIREMENT.EXCLUSIVE)
    // iam.register('event','listener4', ACCESS_REQUIREMENT.SET_EXCLUSIVE)
    // iam.register('event','listener5', ACCESS_REQUIREMENT.SET_EXCLUSIVE)
    // iam.register('event','listener6', ACCESS_REQUIREMENT.SET_EXCLUSIVE)
    // iam.register('event','listener7')
    // iam.register('event','listener8')

    // let allowed = iam.getAllowed('event')
    // expect(allowed.length).to.equal(1);
    // expect(allowed).to.deep.equal(['listener3'])    
  })

})