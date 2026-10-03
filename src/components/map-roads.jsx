import React, { Component } from 'react';
import PropTypes from 'prop-types';

import './map-roads.css';

class MovingDot extends Component {
	constructor(props) {
		super(props);
		this.animate = this.animate.bind(this);
	}
	componentDidMount() {
		const points = this.props.route.positions;

		this.points = points;
		this.distances = [0];

		for (let i = 1; i < points.length; i++) {
			const dx = points[i].x - points[i - 1].x;
			const dy = points[i].y - points[i - 1].y;

			this.distances.push(
				this.distances[i - 1] + Math.sqrt(dx * dx + dy * dy)
			);
		}

		this.totalDistance = this.distances[this.distances.length - 1];
		this.startedAt = performance.now();
		this.frame = requestAnimationFrame(this.animate);
	}

	componentWillUnmount() {
		cancelAnimationFrame(this.frame);
	}

	animate(now) {
		const elapsed = Math.max(0, now - this.startedAt - 2000);
		const distance = ((elapsed % 30000) / 30000) * this.totalDistance;

		let low = 0;
		let high = this.distances.length - 1;

		while (low < high) {
			const middle = Math.floor((low + high) / 2);

			if (this.distances[middle] < distance) {
				low = middle + 1;
			} else {
				high = middle;
			}
		}

		const end = Math.max(1, low);
		const start = end - 1;
		const length = this.distances[end] - this.distances[start];
		const fraction = length > 0
			? (distance - this.distances[start]) / length
			: 0;

		const a = this.points[start];
		const b = this.points[end];

		this.dot.setAttribute('cx', a.x + (b.x - a.x) * fraction);
		this.dot.setAttribute('cy', a.y + (b.y - a.y) * fraction);

		this.frame = requestAnimationFrame(this.animate);
	};

	render() {
		const first = this.props.route.positions[0];

		return (
			<circle
				ref={dot => { this.dot = dot; }}
				cx={first.x}
				cy={first.y}
				r="1800"
				style={{
					fill: '#fff',
					stroke: '#111',
					strokeWidth: 650,
					pointerEvents: 'none'
				}}
			/>
		);
	}
}

export default class MapRoads extends Component {
	static get propTypes() {
		return {
			roads: PropTypes.array,
			hoveredRouteHash: PropTypes.number,
			selectedRoute: PropTypes.object
		};
	}

	render() {
		const { roads, hoveredRouteHash, selectedRoute } = this.props;

		const routeHash = hoveredRouteHash != null
			? hoveredRouteHash
			: selectedRoute && selectedRoute.routeHash;

		const visibleRoads = routeHash == null
			? []
			: roads.filter(route =>
				Number(route.id) === Number(routeHash)
			);

		const mode = hoveredRouteHash != null ? 'hover' : 'selected';

		return (
			<g className="map-roads">
				{visibleRoads.filter(route => route.glow)
					.map(route => this.renderRoute(route, 'route-glow'))}

				{visibleRoads.map(route =>
					this.renderRoute(route, 'route-line')
				)}

				{visibleRoads.filter(route => route.positions.length >= 2)
					.map(route => (
						<MovingDot
							key={`dot-${route.id}-${mode}`}
							route={route}
						/>
					))}
			</g>
		);
	}

	renderRoute(route, className) {
		const points = route.positions
			.map(point => `${point.x},${point.y}`)
			.join(' ');

		return (
			<polyline
				key={`${className}-${route.id}`}
				className={className}
				points={points}
			/>
		);
	}
}
