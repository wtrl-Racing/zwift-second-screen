import React, { Component} from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import classnames from 'classnames';

import { requestLoginType, postLogin, postLoginById, startWtrlLogin } from '../actions/login';

import { fetchHost, runHost, closeApp } from '../actions/host';

import CookieWarning from './cookie-warning';

import s2 from './app.css';
import s from './login.css';

class Login extends Component {
  static get propTypes() {
    return {
      match: PropTypes.shape({
        params: PropTypes.shape({
          type: PropTypes.string,
          id: PropTypes.string
        }).isRequired
      }).isRequired,
      overlay: PropTypes.bool,
			user: PropTypes.object,
      error: PropTypes.object,
      host: PropTypes.object,
      onSubmit: PropTypes.func.isRequired,
      onSubmitId: PropTypes.func.isRequired,
      onRequestLoginType: PropTypes.func.isRequired,
      onFetchHost: PropTypes.func,
      onRunHost: PropTypes.func,
      onCloseApp: PropTypes.func
    }
  }

  constructor(props) {
    super(props);

    this.state = {
      username: props.user ? props.user.username : '',
      password: '',
      id: props.user ? props.user.id : '',
      aboutZwiftGPS: false,
      aboutGoldRush: false
    };
  }

  componentWillReceiveProps(props) {
    this.setState({
      username: this.state.username || (props.user ? props.user.username : ''),
      id: this.state.id || (props.user ? props.user.id : '')
    });
  }

	render() {
		return (
			<div className="login wtrl-login">
				<div className="wtrl-login-card">
					<img
						className="wtrl-login-logo"
						src="https://www.wtrl.racing/assets/images/wtrl-logos/wtrl-2026.png"
						alt="WTRL"
					/>

					<h1>ZwiftGPS</h1>

					<p>
						Sign in with your WTRL account to use ZwiftGPS.
					</p>

					<button
						className="wtrl-login-button"
						type="button"
						onClick={() => startWtrlLogin()}
					>
						Continue to WTRL
					</button>

					<p className="wtrl-login-note">
						Click Continue to WTRL to sign in.
					</p>
				</div>
			</div>
		);
	}

  onToggleAbout(name) {
    const newState = {};
    newState[name] = !this.state[name];
    this.setState(newState);
  }

  renderAbout() {
    const { aboutZwiftGPS, aboutGoldRush } = this.state;
    return <ul className="about-menu">
      <li className="about-item" onClick={() => this.onToggleAbout('aboutZwiftGPS')}>
        <span className="game-image game-zwiftgps"></span>
        <span className="game-name">About ZwiftGPS</span>
        {aboutZwiftGPS && <div className="about-frame">
          <div className="about-content">
            <h2>About ZwiftGPS</h2>
            <div className="about-desc">
              ZwiftGPS is a companion application for when you're riding in Zwift.

              <img src="/img/about-zwiftgps.png" alt="ZwiftGPS Screenshot" />

              <ul>
                <li>See your position and any friends you're following in Zwift</li>
                <li>Follow riders taking part in Zwift events</li>
              </ul>

              <div className="about-notes">
                You'll need to opt-in to share Zwift activities with ZwiftGPS.
                No activity data is stored after your session ends.
              </div>
            </div>
          </div>
        </div>}
      </li>
      <li className="about-item" onClick={() => this.onToggleAbout('aboutGoldRush')}>
        <span className="game-image game-goldrush"></span>
        <span className="game-name">About GoldRush</span>
        {aboutGoldRush && <div className="about-frame">
          <div className="about-content">
            <h2>About GoldRush</h2>
            <div className="about-desc">
              GoldRush is a game you can play while riding in Zwift

              <img src="/img/about-goldrush.png" alt="ZwiftGPS Screenshot" />

              <ul>
                <li>New game starts every hour</li>
                <li>Ride over coins to get points</li>
                <li>Team games for 4 or more players</li>
              </ul>

              <div className="about-notes">
                You'll need to opt-in to share Zwift activities with ZwiftGPS.
                No activity data is stored after your session ends.
              </div>
            </div>
          </div>
        </div>}
      </li>
    </ul>;
  }

  onSubmitForm(evt) {
    evt.preventDefault();

    const { user, match, onSubmit, onSubmitId } = this.props;
    const { username, password, id } = this.state;

    const loginType = user ? user.type : '';

    const event = match && match.params &&  match.params.event;

    if (loginType === 'user') {
      onSubmit(username, password, event);
    } else {
      onSubmitId(id, event);
    }
  }
}

const mapStateToProps = (state) => {
  return {
    overlay: state.environment.electron || state.environment.openfin,
		user: state.login.user,
    error: state.login.error,
    host: state.host
  }
}

const mapDispatchToProps = (dispatch) => {
  return {
    onRequestLoginType: () => dispatch(requestLoginType()),
    onSubmit: (username, password, event) => dispatch(postLogin(username, password, event)),
    onSubmitId: (id, event) => dispatch(postLoginById(id, event)),
    onFetchHost: () => dispatch(fetchHost()),
    onRunHost: () => dispatch(runHost()),
    onCloseApp: closeApp
  }
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(Login);
