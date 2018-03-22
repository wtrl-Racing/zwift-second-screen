const sinon = require('sinon');
const Rider = require('../rider');

const riderId = 10101;

let testRider;
let mockAccount;
let mockAllRiders;
let mockEvents;
let mockProfile;
let mockGhosts;
let stubStatusFn;

const meProfile = {
  id: riderId,
  me: true
};

const testStatusFn = id => ({ id, x: id + 10, y: id + 20 });

const expectPositions = (positions, ids) => {
  expect(positions.map(p => ({id: p.id, x: p.x, y: p.y })))
      .toEqual(ids.map(id => isNaN(id) ? id : testStatusFn(id)));
}

beforeEach(() => {
  mockAccount = {};
  mockAllRiders = {
    get: sinon.stub()
  };
  mockEvents = {
    findMatchingEvent: sinon.stub(),
    getRiders: sinon.stub(),
    setRidingInEvent: sinon.stub(),
    getRidersInEvent: sinon.stub()
  };
  mockProfile = {
    getProfile: sinon.stub().withArgs(riderId)
        .returns(Promise.resolve(meProfile)),
    getFollowees: sinon.stub()
  };
  mockGhosts = {
    getPositions: sinon.stub().returns([])
  };
  stubStatusFn = sinon.spy(id => Promise.resolve(testStatusFn(id)));

  Rider.cache.flushAll();

  testRider = new Rider(mockAccount, riderId, stubStatusFn);
  testRider.allRiders = mockAllRiders;
  testRider.events = mockEvents;
  testRider.profile = mockProfile;
  testRider.ghosts = mockGhosts;

  testRider.ridingNowDate = null;
  testRider.ridingNow = null;
});

describe('getPositions', () => {
  describe('without filter', () => {
    const friends = [
      { followeeProfile: { id: 20102 } },
      { followeeProfile: { id: 30103 } },
      { followeeProfile: { id: 40104 } }
    ];
    const riding = [
      { playerId: riderId },
      { playerId: 20102 },
      { playerId: 40104 }
    ];

    beforeEach(() => {
      mockProfile.getFollowees.returns(Promise.resolve(friends));
      mockAllRiders.get.returns(Promise.resolve(riding));
    });

    test('gets me and friends who are riding', async () => {
      const positions = await testRider.getPositions();

      expectPositions(positions, [riderId, 20102, 40104]);
    });

    test('inculdes any current ghosts', async () =>
    {
      const ghosts = [
        { id: 60106, x: 61, y: 62 },
        { id: 70107, x: 71, y: 72 }
      ];
      mockGhosts.getPositions.returns(ghosts);

      const positions = await testRider.getPositions();

      expectPositions(positions, [riderId, 20102, 40104, ghosts[0], ghosts[1]]);
    });

    test('don\'t include me if not riding', async () => {
      mockAllRiders.get.returns(Promise.resolve([riding[1], riding[2]]));

      const positions = await testRider.getPositions();

      expectPositions(positions, [20102, 40104]);
    });

    test('gets cached player list after first time', async () => {
      const positions1 = await testRider.getPositions();
      expect(stubStatusFn.callCount).toBe(3);

      const positions2 = await testRider.getPositions();

      expectPositions(positions2, [riderId, 20102, 40104]);

      expect(mockProfile.getProfile.callCount).toBe(1);
      expect(mockProfile.getFollowees.callCount).toBe(1);
      expect(stubStatusFn.callCount).toBe(6);
    });
  });

  describe('with name filter', () => {
    const riding = [
      { playerId: riderId, firstName: 'Fred', lastName: 'Bloggs' },
      { playerId: 20102, firstName: 'Smithey', lastName: 'Smoo' },
      { playerId: 30103, firstName: 'Ted', lastName: 'McSmi-thom' },
      { playerId: 40104, lastName: 'McSmithom' }
    ];

    beforeEach(() => {
      testRider.setFilter('smith');
      mockAllRiders.get.returns(Promise.resolve(riding));
    });

    test('gets all name matches and adds me', async () => {

      const positions = await testRider.getPositions();

      expectPositions(positions, [riderId, 20102, 40104]);
    });
  });

  describe('with event id filter', () => {
    const event = {
      eventSubgroups: [
        { id: 91, label: 1},
        { id: 92, label: 2}
      ]
    };
    const subEvent91 = [
      { id: 40104 }
    ];
    const subEvent92 = [
      { id: 30103 },
      { id: 50105 }
    ];

    beforeEach(() => {
      testRider.setFilter('event:913');
      mockEvents.findMatchingEvent.withArgs('913')
          .returns(Promise.resolve(event));

      mockEvents.getRiders.withArgs(91).returns(Promise.resolve(subEvent91));
      mockEvents.getRiders.withArgs(92).returns(Promise.resolve(subEvent92));
    });

    test('gets all name matches and adds me', async () => {
      const positions = await testRider.getPositions();

      expectPositions(positions, [riderId, 40104, 30103, 50105]);
    });

    test('gets all name matches including me and sorts', async () => {
      mockEvents.getRiders.withArgs(92).returns(Promise.resolve([
        { id: 30103 }, { id: riderId }, { id: 50105 }
      ]));

      const positions = await testRider.getPositions();

      expectPositions(positions, [riderId, 30103, 50105, 40104]);
    });

    test('cannot find event', async () => {
      mockEvents.findMatchingEvent.withArgs('913')
            .returns(Promise.resolve(null));

      const positions = await testRider.getPositions();

      expectPositions(positions, [riderId]);
    });

    test('doesn\'t use event name tracker', async () => {
      const positions = await testRider.getPositions();

      expect(mockEvents.setRidingInEvent.called).toBe(false);
      expect(mockEvents.getRidersInEvent.called).toBe(false);
    });
  });

  describe('with event name filter matching official event', () => {
    const event = {
      eventSubgroups: [
        { id: 91, label: 1},
        { id: 92, label: 2}
      ]
    };
    const subEvent91 = [
      { id: 40104 }
    ];
    const subEvent92 = [
      { id: 30103 },
      { id: 50105 }
    ];

    beforeEach(() => {
      testRider.setFilter('event:test');
      mockEvents.findMatchingEvent.withArgs('test')
          .returns(Promise.resolve(event));

      mockEvents.getRiders.withArgs(91).returns(Promise.resolve(subEvent91));
      mockEvents.getRiders.withArgs(92).returns(Promise.resolve(subEvent92));
      mockEvents.getRidersInEvent.returns([]);
    });

    test('gets all name matches and adds me', async () => {
      const positions = await testRider.getPositions();

      expectPositions(positions, [riderId, 40104, 30103, 50105]);
    });

    test('gets all name matches including me and sorts', async () => {
      mockEvents.getRiders.withArgs(92).returns(Promise.resolve([
        { id: 30103 }, { id: riderId }, { id: 50105 }
      ]));

      const positions = await testRider.getPositions();

      expectPositions(positions, [riderId, 30103, 50105, 40104]);
    });

    test('cannot find event', async () => {
      mockEvents.findMatchingEvent.withArgs('test')
            .returns(Promise.resolve(null));

      const positions = await testRider.getPositions();

      expectPositions(positions, [riderId]);
    });

    test('adds user to event name tracker', async () => {
      const positions = await testRider.getPositions();

      expect(mockEvents.setRidingInEvent.calledWith('test')).toBe(true);
      expect(mockEvents.getRidersInEvent.called).toBe(false);
    });
  });

  describe('with event name filter without official event', () => {
    const eventRiders = [
      { id: 20102 },
      { id: riderId },
      { id: 40104 }
    ];

    beforeEach(() => {
      testRider.setFilter('event:test');
      mockEvents.findMatchingEvent.withArgs('test')
          .returns(Promise.resolve(null));

      mockEvents.getRidersInEvent.returns(eventRiders);
    });

    test('gets players in event and doesn\'t add me twice', async () => {
      const positions = await testRider.getPositions();

      expectPositions(positions, [riderId, 20102, 40104]);
    });

    test('gets other players in event and adds me twice', async () => {
      mockEvents.getRidersInEvent.returns([eventRiders[2]]);

      const positions = await testRider.getPositions();

      expectPositions(positions, [riderId, 40104]);
    });

    test('adds user to event name tracker', async () => {
      const positions = await testRider.getPositions();

      expect(mockEvents.setRidingInEvent.calledWith('test')).toBe(true);
    });
  });

  describe('with all:users keyword', () => {
    beforeEach(() => {
      testRider.setFilter('all:users');
    });

    test('gets me as the only player', async () => {
      const positions = await testRider.getPositions();

      expectPositions(positions, [riderId]);
    });

    test('gets any other recent players too', async () => {
      const otherRider = new Rider(mockAccount, 20102, stubStatusFn);
      otherRider.allRiders = mockAllRiders;
      otherRider.events = mockEvents;
      otherRider.ghosts = mockGhosts;

      otherRider.profile = {
        getProfile: sinon.stub().withArgs(riderId)
            .returns(Promise.resolve({ id: 20102 })),
        getFollowees: sinon.stub().returns(Promise.resolve([]))
      };

      mockProfile.getFollowees.returns(Promise.resolve([]));
      mockAllRiders.get.returns(Promise.resolve([]));

      const otherPositions = await otherRider.getPositions();

      const positions = await testRider.getPositions();

      expectPositions(positions, [riderId, 20102]);
    });
  });
});