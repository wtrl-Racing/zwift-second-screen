import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import classnames from 'classnames';
import moment from 'moment';
import axios from 'axios';

import { fetchProfile, fetchEvents } from '../actions/fetch';
import { requestLoginType } from '../actions/login';
import { setSelectedRoute, setHoveredRoute, setMenuState, showWorldSelector, setWorld, showStravaSettings, showRiderFilter, setRiderFilter, showGameSelector } from '../actions/summary';
import { connectStrava, disconnectStrava, saveStravaSettings } from '../actions/strava';
import { toggleFullScreen } from './full-screen';


import s from './summary.css';

const EVENT_PREFIX = "event:";

class Summary extends Component {
  static get propTypes() {
    return {
      showingMenu: PropTypes.bool,
      showingWorldSelector: PropTypes.bool,
      profile: PropTypes.object.isRequired,
      user: PropTypes.object,
      mapSettings: PropTypes.object,
      onShowStravaSettings: PropTypes.func,
      showingStravaSettings: PropTypes.bool,
      stravaConnected: PropTypes.bool,
      stravaSettings: PropTypes.any.isRequired,
      showingRiderFilter: PropTypes.bool,
      showingGameSelector: PropTypes.bool,
      events: PropTypes.array,
      currentEvent: PropTypes.object,
      eventsFetching: PropTypes.bool,
      riderFilterEvent: PropTypes.string,
      eventName: PropTypes.string,
      whatsNew: PropTypes.object,
      onSetMenuState: PropTypes.func.isRequired,
      onShowWorldSelector: PropTypes.func.isRequired,
      onSetWorld: PropTypes.func.isRequired,
      onRequestLoginType: PropTypes.func.isRequired,
      onFetch: PropTypes.func.isRequired,
      onConnectStrava: PropTypes.func.isRequired,
      onDisconnectStrava: PropTypes.func.isRequired,
      onSaveStravaSettings: PropTypes.func.isRequired,
      onShowRiderFilter: PropTypes.func.isRequired,
      onSetRiderFilter: PropTypes.func.isRequired,
      onShowGameSelector: PropTypes.func.isRequired
    };
  }

	constructor(props) {
		super();

		this.state = {
			stravaAgeValid: true,
			stravaDateValid: true,
			stravaSettings: props.stravaSettings,
			showingRoutes: false,
			routes: [],
			routesLoading: false,
			routesError: null,
			routesSort: 'name'
		}
	}

	componentWillReceiveProps(props) {
		this.setState({
			stravaAgeValid: true,
			stravaDateValid: true,
			stravaSettings: props.stravaSettings
		});

		if (
			this.state.showingRoutes &&
			Number(props.worldId) !== Number(this.props.worldId)
		) {
			this.loadRoutes(props.worldId);
		}
	}

  componentDidMount() {
    const { onFetch, onRequestLoginType } = this.props;
    onFetch();
    onRequestLoginType();
    this.fetchInterval = setInterval(onFetch, 30000);
  }

  componentWillUnmount() {
    clearInterval(this.fetchInterval);
  }

  render() {
    const { showingMenu, showingWorldSelector, profile, mapSettings, user,
      events, currentEvent, eventsFetching, eventName, riderFilterEvent, whatsNew,
      showingGameSelector, showingStravaSettings, stravaConnected, onShowStravaSettings,
      showingRiderFilter, onShowRiderFilter, onShowGameSelector,
      onSetMenuState, onShowWorldSelector, onSetWorld, onSaveStravaSettings } = this.props;
		const { stravaAgeValid, stravaSettings, showingRoutes } = this.state;
    const { credit } = mapSettings;
    const disabled = !profile.riding;

    const newFeature = !!Object.keys(whatsNew).find(k => !whatsNew[k]);
    // And for links:
    // <a className={classnames('gameSelector', { newFeature: !whatsNew.games })}

    return (
      <div className="summary">
        <button
              className={classnames('app-button', 'menu-button')}
              onClick={() => { onSetMenuState(!showingMenu); }}>
          <span className="zwiftgps-icon icon-menu">&nbsp;</span>
        </button>
        {newFeature && <div className="menu-button-new newFeature">&nbsp;</div>}
        {riderFilterEvent && <div className="summary-filtered-event">
          <span className="event-name">{riderFilterEvent}</span>
          <button className="cancel-event" onClick={() => this.setFilterType(0)}>
            <span className="zwiftgps-icon icon-minimize">&nbsp;</span>
          </button>
        </div>}

        {currentEvent && !riderFilterEvent && !eventName && <ul className="summary-quick-links">
          {this.renderEventDetail(currentEvent)}
        </ul>}

        <div className={classnames("menu-overlay", { hide: !showingMenu })}
              onMouseDown={() => onSetMenuState(false)}
              onTouchStart={() => onSetMenuState(false)}
            >
        </div>
        <div className={classnames("menu-content", { hide: !showingMenu })}
              onTouchStart={e => this.onTouchStart(e)}
              onTouchMove={e => this.onTouchMove(e)}
              onTouchEnd={e => this.onTouchEnd(e)}
              onClick={() => onSetMenuState(false)}
          >
          <div className="header">
            <div className={classnames("logo")}></div>
            <div className="player-name">
              <span className={classnames("name")}>
                {profile.firstName} {profile.lastName}
              </span>
            </div>
          </div>
{showingRoutes ? this.renderRoutesMenu() : (
		<ul className="actions">
			<li>
			  <a className="wtrl" href="https://www.wtrl.racing" target="_blank">
				<span class="icon-container"><i class="fa-light fa-house"></i></span>
				<span>WTRL Home</span>
			  </a>
			</li>
            <li>
              <a className="fullScreen" href="#" onClick={e => this.toggleFullScreen(e)}>
                <span class="icon-container"><i class="fa-regular fa-expand fa-lg"></i></span>
                <span>Full Screen</span>
              </a>
            </li>

            { (user && user.canSetWorld)
              ? <li>
                  <a className="world" href="#" onClick={e => this.showWorldSelector(e)}>
                      <span class="icon-container"><i class="fa-light fa-earth-americas fa-lg"></i></span>
                      <span>Change World</span>
                  </a>
                </li>
								: undefined}

							<li>
								<a
									className="routes"
									href="#"
									onClick={e => {
										e.preventDefault();
										e.stopPropagation();
										this.setState({ showingRoutes: true }, () => {
											this.loadRoutes();
										});
									}}
								>
									<span class="icon-container"><i class="fa-regular fa-route"></i></span>
									<span>View Routes</span>
								</a>
							</li>

							{(user && user.canFilterRiders && !eventName)
								? <li>
									<a className="riderFilter" href="#" onClick={e => this.showRiderFilter(e)}>
										<span class="icon-container"><i class="fa-kit fa-zwift fa-lg"></i></span>
										<span>Events</span>
									</a>
								</li>
								: undefined}

            { (user && user.canStrava && !profile.anonymous)
              ? <li>
                  <a className="world" href="#" onClick={e => this.showStravaSettings(e)}>
                      <span class="icon-container"></span>
                      <span>Strava</span>
                  </a>
                </li>
              : undefined }

            { (user && user.canLogout)
              ? <li>
                  <a className="gameSelector" href="#" onClick={e => this.showGameSelector(e)}>
                    <span class="icon-container"><i class="fa-light fa-gamepad-modern fa-lg"></i></span>
                    <span>Games</span>
                  </a>
                </li>
              : undefined }

			{ (user && user.canLogout)
              ? <li>
					<a className="helpcenter" href="https://support.wtrl.racing/hc/en-us/categories/12622256835995-Zwift-GPS" target="_blank" rel="noopener">
                    <span class="icon-container"><i class="fa-light fa-question"></i></span>
                    <span>Help Centre</span>
                  </a>
                </li>
              : undefined }

            { (user && user.canLogout)
              ? <li>
                  <a className="feedback" href="mailto:racecontrol@wtrl.racing" target="_blank" rel="noopener">
                     <span class="icon-container"><i class="fa-light fa-envelope fa-lg"></i></span>
										 <span>Contact WTRL</span>
                  </a>
                </li>
              : undefined }

            { (user && user.canLogout)
              ? <li>
									<a className="logout" href="/login" onClick={evt => {
											evt.preventDefault();

											axios.post('/logout')
												.then(() => {
													window.location.replace('/login?loggedOut=1');
												})
												.catch(() => {
													window.alert('Unable to log out. Please try again.');
												});
										}}
									>
										<span className="icon-container">
											<i className="fa-light fa-right-from-bracket fa-lg"></i>
										</span>
										<span>Logout</span>
									</a>
                </li>
            : undefined }
						</ul>
					)}
        </div>

        {showingWorldSelector ?
          <div>
            <div className="popup-overlay"
                  onMouseDown={() => onShowWorldSelector(false)}
                  onTouchStart={() => onShowWorldSelector(false)}
                >
            </div>
            <div className="popup-content world-selector">
              <h2>Select A Zwift World</h2>
              <ul>
                <li onClick={() => onSetWorld(1)}>
                  <span className="world-image world-1"></span>
                  <span className="world-name">Watopia</span>
                </li>
                <li onClick={() => onSetWorld(2)}>
                  <span className="world-image world-2"></span>
                  <span className="world-name">Richmond</span>
                </li>
                <li onClick={() => onSetWorld(3)}>
                  <span className="world-image world-3"></span>
                  <span className="world-name">London</span>
                </li>
                <li onClick={() => onSetWorld(4)}>
                  <span className="world-image world-4"></span>
                  <span className="world-name">New York</span>
                </li>
                <li onClick={() => onSetWorld(5)}>
                  <span className="world-image world-5"></span>
                  <span className="world-name">Innsbruck</span>
                </li>
                <li onClick={() => onSetWorld(6)}>
                  <span className="world-image world-6"></span>
                  <span className="world-name">Bologna</span>
                </li>
                <li onClick={() => onSetWorld(7)}>
                  <span className="world-image world-7"></span>
                  <span className="world-name">Yorkshire</span>
                </li>
                <li onClick={() => onSetWorld(8)}>
                  <span className="world-image world-8"></span>
                  <span className="world-name">Crit City</span>
								</li>
								<li onClick={() => onSetWorld(9)}>
                  <span className="world-image world-9"></span>
                  <span className="world-name">Makuri</span>
                </li>
                <li onClick={() => onSetWorld(10)}>
                  <span className="world-image world-10"></span>
                  <span className="world-name">France</span>
                </li>
                <li onClick={() => onSetWorld(11)}>
                  <span className="world-image world-11"></span>
                  <span className="world-name">Paris</span>
								</li>
								<li onClick={() => onSetWorld(12)}>
									<span className="world-image world-12"></span>
									<span className="world-name">Gravel Mountain</span>
								</li>
                <li onClick={() => onSetWorld(13)}>
                  <span className="world-image world-13"></span>
                  <span className="world-name">Scotland</span>
                </li>
              </ul>
            </div>
          </div>
        : undefined }

        {showingStravaSettings ?
          <div>
            <div className="popup-overlay"
                  onMouseDown={() => onShowStravaSettings(false)}
                  onTouchStart={() => onShowStravaSettings(false)}
                >
            </div>
            <div className="popup-content strava-settings">
              <h2><span className="zwiftgps-icon icon-strava">&nbsp;</span> Strava Segments</h2>
              <div className="description">
                Live PR comparison for "ZwiftBlog verified" segments
              </div>
              <div className="description">
                Star Strava segments to add them to ZwiftGPS
              </div>
              <div className="connection-buttons">
                <a className="button" href="#"
                    onClick={e => this.stravaToggleConnection(e)}
                  >
                    {stravaConnected ? 'Disconnect' : 'Connect'}
                </a>
              </div>
              <div className="strava-config-startdate">
                <h3>Lookup Strava Personal Records for</h3>
                <ul>
                  <li>
                    <input type="radio" name="startdate" id="stravaStartNone"
                        checked={!stravaSettings.startAge && !stravaSettings.startDate}
                        onChange={() => onSaveStravaSettings({})} />
                    <label htmlFor="stravaStartNone">all time</label>
                  </li>
                  <li>
                    <input type="radio" name="startdate" id="stravaStartAge"
                        checked={stravaSettings.startAge !== undefined}
                        onChange={() => onSaveStravaSettings({ startAge: 90 })} />
                    <label htmlFor="stravaStartAge">last
                      <input type="text" value={stravaSettings.startAge !== undefined ? stravaSettings.startAge : 90}
                          className={classnames("age", { error: !stravaAgeValid })}
                          onChange={event => this.stravaSettingsAge(event)}
                        />
                    days</label>
                  </li>
                  <li>
                    <input type="radio" name="startdate" id="stravaStartDate"
                        checked={stravaSettings.startDate}
                        onChange={() => onSaveStravaSettings({startDate: '2017-01-01T00:00:00Z'})} />
                    <label htmlFor="stravaStartDate">since 1st Jan 2017</label>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        : undefined }

        {showingRiderFilter ?
          <div>
            <div className="popup-overlay"
                  onMouseDown={() => onShowRiderFilter(false)}
                  onTouchStart={() => onShowRiderFilter(false)}
                >
            </div>
            <div className="popup-content rider-filter">
              <h2>Events</h2>
                <ul>
                  <li className="event-item" onClick={() => this.setFilterType(0)}>
                    <div className="event-free">
                      <span className="event-name">Free ride</span>
                    </div>
                  </li>
                  {events && events.slice().reverse().map(e => this.renderEventDetail(e))}
              </ul>
              {eventsFetching && <div>Loading...</div>}
            </div>
          </div>
        : undefined }


        {showingGameSelector ?
          <div>
            <div className="popup-overlay"
                  onMouseDown={() => onShowGameSelector(false)}
                  onTouchStart={() => onShowGameSelector(false)}
                >
            </div>
            <div className="popup-content game-selector">
            <h2>ZwiftGPS Games</h2>
              <ul>
                <li onClick={() => this.onSelectGame('')}>
                  <span className="game-image game-zwiftgps"></span>
                  <span className="game-name">ZwiftGPS</span>
                </li>
                <li onClick={() => this.onSelectGame('zwiftquest')}>
                  <span className="game-image game-zwiftquest"></span>
                  <span className="game-name">ZwiftQuest</span>
                </li>
                <li onClick={() => this.onSelectGame('goldrush')}>
                  <span className="game-image game-goldrush"></span>
                  <span className="game-name">GoldRush</span>
                </li>
              </ul>
            </div>
          </div>
        : undefined }

        {credit ?
          <div className="map-attribute">
            {credit.prompt || 'Map by'} <a href={credit.href} target="_blank" rel="noopener">{credit.name}</a>
          </div>
        : undefined }
      </div>
    )
  }

	loadRoutes(worldId = this.props.worldId) {
		const requestId = (this.routesRequestId || 0) + 1;
		this.routesRequestId = requestId;

		this.setState({
			routes: [],
			routesLoading: true,
			routesError: null
		});

		axios.get(`/routes/world/${worldId}`)
			.then(response => {
				if (this.routesRequestId !== requestId) {
					return;
				}

				const routes = response.data.routes;

				if (!Array.isArray(routes)) {
					throw new Error('Invalid routes response.');
				}

				this.setState({
					routes: routes.slice().sort((a, b) =>
						String(a.routeName).localeCompare(String(b.routeName))
					),
					routesLoading: false,
					routesError: null
				});
			})
			.catch(error => {
				if (this.routesRequestId !== requestId) {
					return;
				}

				const status = error.response && error.response.status;

				this.setState({
					routes: [],
					routesLoading: false,
					routesError: status === 401
						? 'Please sign in through WTRL again.'
						: 'Unable to load routes. Please try again.'
				});
			});
	}

	renderRoutesMenu() {
		const worldNames = {
			1: 'Watopia',
			2: 'Richmond',
			3: 'London',
			4: 'New York',
			5: 'Innsbruck',
			6: 'Bologna',
			7: 'Yorkshire',
			8: 'Crit City',
			9: 'Makuri Islands',
			10: 'France',
			11: 'Paris',
			12: 'Gravel Mountain',
			13: 'Scotland'
		};

		const worldName = worldNames[this.props.worldId] || 'Current world';

		const sortedRoutes = this.state.routes.slice().sort((a, b) => {
			const byName = String(a.routeName).localeCompare(String(b.routeName));

			if (this.state.routesSort === 'distance') {
				return Number(a.distanceInMeters) - Number(b.distanceInMeters)
					|| byName;
			}

			if (this.state.routesSort === 'released') {
				const releaseTime = value => {
					const date = moment(value, moment.ISO_8601, true);
					return date.isValid() ? date.valueOf() : 0;
				};

				return releaseTime(b.releaseDate) - releaseTime(a.releaseDate)
					|| byName;
			}

			return byName;
		});

		return (
			<div onClick={e => e.stopPropagation()}>
				<ul className="actions">
					<li>
						<a
							href="#"
							onClick={e => {
								e.preventDefault();
								this.setState({ showingRoutes: false });
							}}
						>
							<span className="icon-container">
								<i className="fa-light fa-arrow-left"></i>
							</span>
							<span>Back to menu</span>
						</a>
					</li>
				</ul>

				<div style={{ padding: '0 20px 20px', color: 'rgb(117, 117, 117)' }}>
					<div style={{
						margin: '8px 0 16px',
						paddingBottom: '14px',
						borderBottom: '1px solid rgba(255,255,255,0.12)'
					}}>
						<div style={{
							color: '#909090',
							fontSize: '11px',
							fontWeight: 600,
							letterSpacing: '1.5px',
							textTransform: 'uppercase',
							marginBottom: '6px'
						}}>
							Explore routes for
						</div>

						<h4 style={{
							margin: 0,
							color: 'rgb(217, 185, 48)',
							fontSize: '22px',
							fontWeight: 700,
							lineHeight: 1.2
						}}>
							{worldName}
						</h4>
					</div>
					<div style={{ position: 'relative', marginBottom: '15px' }}>
						<button
							type="button"
							aria-expanded={this.state.showRoutesSort}
							onClick={() => this.setState(state => ({
								showRoutesSort: !state.showRoutesSort
							}))}
							style={{
								background: 'transparent',
								border: 0,
								borderRadius: 0,
								padding: '7px 0',
								color: '#c4c4c4',
								font: 'inherit',
								cursor: 'pointer'
							}}
						>
							{{ name: 'Name', distance: 'Distance', released: 'Released' }[
								this.state.routesSort
							]}
							<i
								className="fa-solid fa-arrow-down-short-wide"
								aria-hidden="true"
								style={{ marginLeft: '10px' }}
							/>
						</button>

						{this.state.showRoutesSort && (
							<div style={{
								position: 'absolute',
								top: '100%',
								left: 0,
								width: '210px',
								background: '#282828',
								boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
								zIndex: 10
							}}>
								{[
									{
										value: 'name',
										label: 'Name',
										icon: 'fa-arrow-up-z-a'
									},
									{
										value: 'distance',
										label: 'Distance',
										icon: 'fa-arrow-down-short-wide'
									},
									{
										value: 'released',
										label: 'Released',
										icon: 'fa-arrow-down-1-9'
									}
								].map(option => (
									<button
										key={option.value}
										type="button"
										onClick={() => this.setState({
											routesSort: option.value,
											showRoutesSort: false
										})}
										style={{
											display: 'flex',
											alignItems: 'center',
											width: '100%',
											background: 'transparent',
											border: 0,
											borderRadius: 0,
											padding: '14px 16px',
											color: this.state.routesSort === option.value
												? '#ffd525' : '#c4c4c4',
											font: 'inherit',
											textAlign: 'left',
											cursor: 'pointer'
										}}
									>
										<i
											className={`fa-sharp fa-solid ${option.icon}`}
											aria-hidden="true"
											style={{ width: '30px' }}
										/>
										{option.label}
									</button>
								))}
							</div>
						)}
					</div>
					{this.state.routesLoading && <p>Loading routes…</p>}

					{this.state.routesError && (
						<p style={{ color: '#ffd525' }}>
							{this.state.routesError}
						</p>
					)}
					<ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
						{sortedRoutes.map(route => (
							<li
								key={route.routeHash}
								onClick={event => {
									event.stopPropagation();

									const selected = this.props.selectedRoute;
									const isSelected = selected &&
										Number(selected.routeHash) === Number(route.routeHash);

									this.props.onSelectRoute(isSelected ? null : route);
								}}
								style={{
									padding: '10px 0',
									borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
								}}
							>
								<div
									onMouseEnter={() => {
										this.props.onHoverRoute(route.routeHash);
									}}
									onMouseLeave={() => {
										this.props.onHoverRoute(null);
									}}
									style={{
										color: '#c4c4c4',
										fontWeight: 700,
										cursor: 'pointer'
									}}
								>
									{route.routeName}
								</div>

								<div style={{ color: '#c4c4c4', fontSize: '12px' }}>
									{(Number(route.distanceInMeters) / 1000).toFixed(1)} km
									{' · '}
									{Math.round(Number(route.ascentInMeters))} m ascent
								</div>
								{this.props.selectedRoute &&
									Number(this.props.selectedRoute.routeHash) === Number(route.routeHash) && (
										<div
											onClick={event => event.stopPropagation()}
											style={{
												marginTop: '12px',
												padding: '12px',
												background: 'rgba(255, 255, 255, 0.05)',
												borderLeft: '3px solid var(--wtrl-gold)',
												color: '#c4c4c4',
												fontSize: '13px',
												lineHeight: '1.8'
											}}
										>
											<div>
											<i class="fa-solid fa-route"></i>: {(Number(route.distanceInMeters) / 1000).toFixed(2)} km
											</div>
											<div>
											<i class="far fa-mountains" aria-hidden="true"></i>: {Math.round(Number(route.ascentInMeters))} m
											</div>
											<div>
												Lead-in: {(Number(route.leadinDistanceInMeters || 0) / 1000).toFixed(2)} km
											</div>
											<div>
												Lead-in ascent: {Math.round(Number(route.leadinAscentInMeters || 0))} m
											</div>
											<div>
											<i class="fa-kit fa-zwift fa-lg"></i>: {route.routeHash}
										</div>
										{route.zwiftinsiderId && (
											<div>
												<a
													href={`https://zwiftinsider.com/route/${encodeURIComponent(route.zwiftinsiderId)}/`}
													target="_blank"
													rel="noopener"
													onClick={event => event.stopPropagation()}
													style={{ color: 'rgb(217, 185, 48)' }}
												>
													Zwift Insider
												</a>
											</div>
										)}
										{Number(route.stravaSegmentId) > 0 && (
											<div>
												<a
													href={`https://www.strava.com/segments/${route.stravaSegmentId}`}
													target="_blank"
													rel="noopener"
													onClick={event => event.stopPropagation()}
													style={{ color: 'rgb(217, 185, 48)' }}
												>
													<i class="fa-brands fa-strava"></i> Strava Segment
												</a>
											</div>
										)}
											{route.releaseDate && (
												<div>
													Released: {moment(route.releaseDate).format('D MMM YYYY')}
												</div>
											)}

											<button
												type="button"
												onClick={event => {
													event.stopPropagation();
													this.props.onSelectRoute(null);
													this.props.onHoverRoute(null);
												}}
											style={{
												marginTop: '10px',
												padding: '6px 12px',
												border: '1px solid rgb(217, 185, 48)',
												borderRadius: 0,
												background: 'rgb(217, 185, 48)',
												color: '#000',
												cursor: 'pointer'
											}}
											>
												Close details
											</button>
										</div>
									)}
							</li>
						))}
					</ul>
				</div>
			</div>
		);
	}

  renderEventDetail(e) {
    return (
      <li key={`event-${e.id}`}
        onClick={() => this.setFilterType(2, `${EVENT_PREFIX}${e.id}`)}
        className="event-item"
        style={{ backgroundImage: e.imageUrl ? `url(${e.imageUrl})` : '' }}
      >
      <div className="event-content">
        <div className="event-line">
          <span className="event-time">{moment(e.eventStart).format('LT')}</span>
          <span className="event-name">{e.name}</span>
        </div>
        <div className="event-line">
          {e.eventSubgroups && e.eventSubgroups.map(g => 
            <span key={`event-grp-${g.id}`} className={classnames('group', `group-${g.label}`)}>{g.totalEntrantCount}</span>
          )}
        </div>
      </div>
    </li>);
  }

  onTouchStart(event) {
    this.touchStartTime = new Date();
    this.touchStart = event.touches && event.touches.length
        ? event.touches[0]
        : null;
  }
  onTouchMove(event) {
    this.touchMove = event.touches && event.touches.length
        ? event.touches[0]
        : null;
  }
	onTouchEnd(event) {
    const { onSetMenuState } = this.props;
    if (this.touchStart && this.touchMove) {
      const distanceX = Math.abs(this.touchStart.clientX - this.touchMove.clientX),
            distanceY = Math.abs(this.touchStart.clientY - this.touchMove.clientY),
            time = new Date() - this.touchStartTime;
      if (distanceX > 50 && distanceX > 3 * distanceY && time < 300){
        onSetMenuState(false);
      }
    }
  }

  toggleFullScreen(event) {
    event.preventDefault();
    toggleFullScreen();
  }

  showWorldSelector(event) {
    const { onShowWorldSelector } = this.props;
    event.preventDefault();
    onShowWorldSelector(true);
  }

  showStravaSettings(event) {
    const { onShowStravaSettings } = this.props;
    event.preventDefault();
    onShowStravaSettings(true);
  }

  stravaToggleConnection(event) {
    const { stravaConnected, onDisconnectStrava, onConnectStrava } = this.props;
    event.preventDefault();

    if (stravaConnected) {
      onDisconnectStrava();
    } else {
      onConnectStrava();
    }
  }

  stravaSettingsAge(event) {
    const { onSaveStravaSettings } = this.props;
    const startAge = parseInt(event.target.value);

    this.setState( {
      stravaAgeValid: startAge > 0,
      stravaSettings: {
        startAge: event.target.value
      }
    });

    if (startAge > 0) {
      onSaveStravaSettings({ startAge });
    }
  }

  setFilterType(filterType, riderFilter) {
    const { onSetRiderFilter } = this.props;
    onSetRiderFilter((filterType !== 0) ? riderFilter : '');
  }

  showRiderFilter(event) {
    const { onShowRiderFilter, onGetEvents } = this.props;
    event.preventDefault();
    onShowRiderFilter(true);
    onGetEvents();
  }

  showGameSelector(event) {
    const { onShowGameSelector } = this.props;
    event.preventDefault();
    onShowGameSelector(true);
  }

  onSelectGame(game) {
    const { onShowGameSelector } = this.props;
    onShowGameSelector(false);
    window.location = `/${game}`;
  }
}

const mapStateToProps = (state) => {
	return {
		worldId: state.world.worldId,
    showingMenu: state.summary.showingMenu,
    showingWorldSelector: state.summary.worldSelector,
    profile: state.profile,
		user: state.login.user,
    mapSettings: state.mapSettings,
    showingStravaSettings: state.summary.showStravaSettings,
    stravaConnected: state.world.strava ? state.world.strava.connected : false,
    stravaSettings: state.summary.stravaSettings,
    showingRiderFilter: state.summary.showRiderFilter,
    showingGameSelector: state.summary.showGameSelector,
    eventName: state.summary.eventName,
    riderFilterEvent: state.summary.riderFilterEvent,
    events: state.summary.events,
    eventsFetching: state.summary.eventsFetching,
		whatsNew: state.summary.whatsNew,
		selectedRoute: state.summary.selectedRoute,
    currentEvent: state.world.currentEvent
  }
}

const mapDispatchToProps = (dispatch) => {
	return {
		onSelectRoute: route => dispatch(setSelectedRoute(route)),
    onSetMenuState: showMenu => dispatch(setMenuState(showMenu)),
    onShowWorldSelector: showSelector => dispatch(showWorldSelector(showSelector)),
    onSetWorld: worldId => dispatch(setWorld(worldId)),
    onShowStravaSettings: showStrava => dispatch(showStravaSettings(showStrava)),
    onRequestLoginType: () => dispatch(requestLoginType()),
    onFetch: () => dispatch(fetchProfile()),
    onConnectStrava: () => dispatch(connectStrava()),
    onDisconnectStrava: () => dispatch(disconnectStrava()),
    onSaveStravaSettings: (settings) => dispatch(saveStravaettings(settings)),
    onShowRiderFilter: show => dispatch(showRiderFilter(show)),
    onShowGameSelector: show => dispatch(showGameSelector(show)),
		onSetRiderFilter: filter => dispatch(setRiderFilter(filter)),
		onHoverRoute: routeHash => dispatch(setHoveredRoute(routeHash)),
    onGetEvents: () => dispatch(fetchEvents())
  }
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(Summary);
