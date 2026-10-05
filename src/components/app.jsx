import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import classnames from 'classnames';

import CookieWarning from './cookie-warning';
import Summary from './summary';
import Map from './map';
import Ghosts from './ghosts';
import InfoPanel from './infoPanel';
import StravaSegments from './strava-segments';
import Analytics from './analytics';
import Zoom from './zoom';

import { closeApp } from '../actions/host';
import { setZoomLevel, setEventName } from '../actions/summary';
import { fetchStravaSegments } from '../actions/fetch';

import s from './app.css';

const mapZoomLevels = {
  1: 3.5,
  2: 1.9,
  3: 1.8,
  4: 6,
	5: 2.5,
	6: 2.5,
	7: 2.3,
	8: 6,
  9: 1.7,
	10: 2,
	11: 1.6,
	12: 1.7,
	13: 2.5
};
const mapDefaultCenter = {
  1: { x: 0.6, y: 0.2 },
  2: { x: 0.5, y: 0.5 },
  3: { x: 0.5, y: 0.55 },
	4: { x: 0.5, y: 0.15 },
	5: { x: 0.47, y: 0.35 },
	6: { x: 0.5, y: 0.55 },
  7: { x: 0.5, y: 0.5 },
  9: { x: 0.55, y: 0.56 },
	10: { x: 0.5, y: 0.3 },
	11: { x: 0.5, y: 0.4 }, // { x: 0.30813, y: 0.33490 },
  13: { x: 0.5, y: 0.51 }
};

class App extends Component {
  static get propTypes() {
    return {
      match: PropTypes.shape({
        params: PropTypes.shape({
          type: PropTypes.string,
          id: PropTypes.string
        }).isRequired
      }).isRequired,
      location: PropTypes.shape({
        search: PropTypes.string
      }).isRequired,
      worldId: PropTypes.number,
      showInfo: PropTypes.bool,
      eventName: PropTypes.string,
      overlay: PropTypes.bool,
      openfin: PropTypes.bool,
      onCloseApp: PropTypes.func,
      onFetchStrava: PropTypes.func
    };
  }

  constructor(props) {
    super(props);

    this.state = {
			hovering: false
    };
  }

  componentDidMount() {
    const { match, location, setEventName, onFetchStrava } = this.props;
    const query = location && location.search ? location.search.substring(1).split('&') : [];

    const event = match && match.params && match.params.event && (match.params.event !== 'dev')
        ? match.params.event.trim() : undefined;
    const strava = query
        .map(term => term.split('='))
        .find(pair => pair[0] === 'strava');

    setEventName(event);
    if (strava) {
      onFetchStrava(strava[1]);
    }
  }

  componentWillUnmount() {
    if (this.mouseMoveTimeout) {
      clearTimeout(this.mouseMoveTimeout);
    }
  }

  render() {
    const { worldId, showInfo, eventName, match, overlay, openfin, onCloseApp, onSetZoomLevel } = this.props;
    const { hovering } = this.state;

    const develop = match && match.params && (match.params.event === 'dev');

    return (
      <div className={classnames("zwift-app", { overlay, openfin, hovering })}>
        <CookieWarning />
        <h1 className="title-bar">
          {document.title}
					<a className="close-button" href="#" onClick={onCloseApp}>X</a>
				</h1>
        <div className="content" onMouseMove={() => this.onMouseMove()}>
          {!develop
						? <Zoom
							ref={control => { this.zoomControl = control; }}
							backgroundColor={
								this.props.mapSettings && this.props.mapSettings.background
							}
							followSelector=".rider-position circle"
							defaultZoom={mapZoomLevels[worldId] || 1}
							defaultCenter={mapDefaultCenter[worldId]}
							onChangeZoomLevel={onSetZoomLevel}
						>
							<Map
								onFitRoute={(positions, group) => {
									if (this.zoomControl) {
										this.zoomControl.fitRoute(positions, group);
									}
								}}
							/>
            </Zoom>
          : <Map develop={develop} /> }
          <Summary />
          {showInfo && <InfoPanel />}
					{!eventName && <Ghosts />}
          <StravaSegments />
				</div>
        <Analytics />
      </div>
    )
  }

  onMouseMove() {
    if (this.mouseMoveTimeout) {
      clearTimeout(this.mouseMoveTimeout);
    }

    this.setState({
			hovering: true
    });
    this.mouseMoveTimeout = setTimeout(() => {
      this.setState({
        hovering: false
      });
      this.mouseMoveTimeout = null;
    }, 3000);
  }
}

const mapStateToProps = (state, ownProps) => {
  return {
    worldId: state.world.worldId,
    showInfo: !!state.world.infoPanel,
    eventName: state.summary.eventName,
    overlay: state.environment.electron || state.environment.openfin,
		openfin: state.environment.openfin,
		mapSettings: state.mapSettings,
  }
}

const mapDispatchToProps = (dispatch) => {
  return {
    onCloseApp: closeApp,
    onSetZoomLevel: level => dispatch(setZoomLevel(level)),
    setEventName: event => dispatch(setEventName(event)),
    onFetchStrava: segments => dispatch(fetchStravaSegments(segments))
  }
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(App);
