import React, { Component } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import classnames from 'classnames';

import images from '../images/images';
import s from './pointOfInterest.css';

const SIZE = 12000;

class PointOfInterest extends Component {
	static get propTypes() {
		return {
			poi: PropTypes.shape({
				name: PropTypes.string,
				x: PropTypes.number,
				y: PropTypes.number
			}),
			scale: PropTypes.number
		};
	}

	constructor(props) {
		super(props);
		this.state = { hovered: false, pinned: false, anchor: null };
		this.dismissOutside = this.dismissOutside.bind(this);
		this.close = this.close.bind(this);
	}

	componentDidMount() {
		document.addEventListener('click', this.dismissOutside, true);
		window.addEventListener('resize', this.close);
		window.addEventListener('scroll', this.close, true);
	}

	componentWillUnmount() {
		document.removeEventListener('click', this.dismissOutside, true);
		window.removeEventListener('resize', this.close);
		window.removeEventListener('scroll', this.close, true);
	}

	close() {
		if (this.state.hovered || this.state.pinned) {
			this.setState({ hovered: false, pinned: false });
		}
	}

	dismissOutside(event) {
		if (this.marker && this.marker.contains(event.target)) return;
		if (this.popup && this.popup.contains(event.target)) return;
		this.close();
	}

	getAnchor() {
		if (!this.marker) return null;
		const rect = this.marker.getBoundingClientRect();
		return { x: rect.left + rect.width / 2, y: rect.bottom };
	}

	showHover() {
		this.setState({ hovered: true, anchor: this.getAnchor() });
	}

	toggle(event) {
		event.stopPropagation();
		this.setState(state => ({
			hovered: false,
			pinned: !state.pinned,
			anchor: this.getAnchor()
		}));
	}

	renderPopover() {
		const { hovered, pinned, anchor } = this.state;
		if ((!hovered && !pinned) || !anchor || !this.props.poi.name) return null;

		const width = Math.min(200, window.innerWidth - 24);
		const left = Math.max(12, Math.min(
			anchor.x - width / 2,
			window.innerWidth - width - 12
		));
		const below = anchor.y + 10 < window.innerHeight - 100;
		const top = Math.max(12, Math.min(anchor.y + 10, window.innerHeight - 100));

		return createPortal(
			<div
				className="poi-name-popover"
				role="tooltip"
				ref={element => { this.popup = element; }}
				onClick={event => event.stopPropagation()}
				style={{
					maxWidth: width,
					left,
					top: below ? top : undefined,
					bottom: below ? undefined : 12
				}}
			>
				<div>{this.props.poi.name}</div>
				{this.props.poi.archId !== undefined && this.props.poi.archId !== null && (
					<div className="poi-arch-id">
						Arch ID: {this.props.poi.archId}
					</div>
				)}
			</div>,
			document.body
		);
	}

	render() {
		const { poi, scale } = this.props;
		const { name, x, y, image, rotate, visited } = poi;
		const iconSize = poi.size || 1;
		const scaledSize = iconSize * SIZE / scale;
		const imageSrc = image && images[image] ? images[image] : images.standard;

		return (
			<g
				className={classnames('point-of-interest', { visited })}
				transform={`translate(${x},${y})`}
				ref={element => { this.marker = element; }}
				role="button"
				tabIndex={0}
				aria-label={name || 'Map marker'}
				aria-expanded={this.state.pinned}
				onMouseEnter={() => this.showHover()}
				onMouseLeave={() => this.setState({ hovered: false })}
				onFocus={() => this.showHover()}
				onBlur={() => this.setState({ hovered: false })}
				onClick={event => this.toggle(event)}
				onKeyDown={event => {
					if (event.key === 'Enter' || event.key === ' ') {
						event.preventDefault();
						this.toggle(event);
					} else if (event.key === 'Escape') {
						event.stopPropagation();
						this.close();
					}
				}}
			>
				<g transform={`rotate(${rotate || 0})`}>
					<image
						x={-scaledSize}
						y={-scaledSize}
						width={2 * scaledSize}
						height={2 * scaledSize}
						xlinkHref={imageSrc}
					/>
				</g>
				{this.renderPopover()}
			</g>
		);
	}
}

export default PointOfInterest;
