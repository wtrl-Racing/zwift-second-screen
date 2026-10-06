import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';

import s from './zoom.css';

const MIN_ZOOM = 1;
const MAX_ZOOM = 12;
const WHEEL_RATE = 0.2;

class Zoom extends Component {
  static get propTypes() {
    return {
      defaultZoom: PropTypes.number,
      defaultCenter: PropTypes.shape({ x: PropTypes.number, y: PropTypes.number }),
      followSelector: PropTypes.string,
      onChangeZoomLevel: PropTypes.func
    };
  }

    constructor(props) {
        super(props)

        this.state = {
            scale: props.defaultZoom || 1,
            center: props.defaultCenter || { x: 0.5, y: 0.5 },
            dragging: false,
            touchStart: {},
            touchLast: {},
            follow: true
        }
    }

	componentDidMount() {
		this.touchListeners = {
			touchstart: event => this.onTouchStart(event),
			touchmove: event => this.onTouchMove(event),
			touchend: event => this.onTouchEnd(event),
			touchcancel: event => this.onTouchCancel(event)
		};

		Object.keys(this.touchListeners).forEach(name => {
			this.zoomElement.addEventListener(
				name,
				this.touchListeners[name],
				{ passive: false, capture: true }
			);
		});
	}

    componentWillReceiveProps(props) {
        let { follow, scale } = this.state;

			if (props.defaultZoom && props.defaultZoom !== this.props.defaultZoom) {
				this.stopZoomAnimation();
				this.routeFitActive = false;

				const center = props.defaultCenter || { x: 0.5, y: 0.5 };
            scale = props.defaultZoom;
            follow = true;
            this.setZoom({ scale, center, follow });
        } else if (follow && scale > 1.1) {
            this.centerOnRider();
        }
    }

    render() {
        const { followSelector } = this.props;
        const { scale, center, follow } = this.state;
        const scalePercent = scale * 100;

			const style = {
						touchAction: 'none',
						width: `${scalePercent}%`,
            height: `${scalePercent}%`,
            top: `${50 - center.y * scale * 100}%`,
            left: `${50 - center.x * scale * 100}%`
        };
				return <div
					className="zoom-container"
					style={{ backgroundColor: this.props.backgroundColor }}
				>
            <div className="zoom-area" style={style} ref={input => { this.zoomElement = input; }}
                        onWheel={e => this.onWheel(e)}
                        onMouseDown={e => this.onMouseDown(e)}
                        onMouseUp={e => this.onMouseUp(e)}
                        onMouseMove={e => this.onMouseMove(e)}
                    >
                {this.props.children}
            </div>

            { followSelector ?
                <button className={classnames("app-button", "zoom-follow-btn", { hide: scale < 1.1, inactive: !follow })} onClick={() => this.clickFollow()}>
                    <span className="zwiftgps-icon icon-follow">&nbsp;</span>
                </button>
            : undefined }
        </div>
		}

	fitRoute(positions, group) {
		if (!this.zoomElement || !group || !Array.isArray(positions)) {
			return;
		}

		const matrix = group.getScreenCTM();
		const area = this.zoomElement.getBoundingClientRect();
		const viewport = this.zoomElement.parentElement.getBoundingClientRect();

		if (!matrix || !area.width || !area.height) {
			return;
		}

		let minX = Infinity;
		let minY = Infinity;
		let maxX = -Infinity;
		let maxY = -Infinity;
		let count = 0;

		positions.forEach(point => {
			const x = Number(point.x);
			const y = Number(point.y);

			if (!Number.isFinite(x) || !Number.isFinite(y)) {
				return;
			}

			const screenX = matrix.a * x + matrix.c * y + matrix.e;
			const screenY = matrix.b * x + matrix.d * y + matrix.f;

			minX = Math.min(minX, screenX);
			minY = Math.min(minY, screenY);
			maxX = Math.max(maxX, screenX);
			maxY = Math.max(maxY, screenY);
			count++;
		});

		if (count < 2) {
			return;
		}

		let left = Math.max(viewport.left, 0);
		const right = Math.min(viewport.right, window.innerWidth);
		const top = Math.max(viewport.top, 0);
		const bottom = Math.min(viewport.bottom, window.innerHeight);

		const menu = window.innerWidth > 600 ? document.querySelector('.summary .menu-content'): null;

		if (menu) {
			const rect = menu.getBoundingClientRect();
			const style = window.getComputedStyle(menu);
			const overlap = Math.min(bottom, rect.bottom) -
				Math.max(top, rect.top);

			if (
				style.display !== 'none' &&
				style.visibility !== 'hidden' &&
				rect.left <= left + 2 &&
				rect.right > left &&
				overlap > (bottom - top) / 2
			) {
				left = Math.min(right, rect.right);
			}
		}

		const width = right - left;
		const height = bottom - top;

		if (width <= 0 || height <= 0) {
			return;
		}

		const padding = Math.min(32, width * 0.08, height * 0.08);

		const scale = Math.max(0.1, Math.min(
			MAX_ZOOM,
			this.state.scale * (width - padding * 2) /
			Math.max(maxX - minX, 1),
			this.state.scale * (height - padding * 2) /
			Math.max(maxY - minY, 1)
		));

		const center = {
			x: ((minX + maxX) / 2 - area.left) / area.width +
				(viewport.left + viewport.width / 2 - (left + right) / 2) /
				(viewport.width * scale),
			y: ((minY + maxY) / 2 - area.top) / area.height +
				(viewport.top + viewport.height / 2 - (top + bottom) / 2) /
				(viewport.height * scale)
		};

		this.routeFitActive = true;

		this.animateZoom(scale, center);
	}

	stopZoomAnimation() {
		if (this.zoomFrame != null) {
			cancelAnimationFrame(this.zoomFrame);
			this.zoomFrame = null;
		}
	}

	animateZoom(targetScale, targetCenter) {
		this.stopZoomAnimation();

		const startScale = this.state.scale;
		const startCenter = Object.assign({}, this.state.center);
		const startedAt = performance.now();
		const duration = 650;

		this.setState({ follow: false, dragging: false });

		const animate = now => {
			const progress = Math.min(1, (now - startedAt) / duration);

			// Ease gently into and out of the movement.
			const eased = progress * progress * (3 - 2 * progress);

			this.setZoom({
				scale: startScale + (targetScale - startScale) * eased,
				center: {
					x: startCenter.x +
						(targetCenter.x - startCenter.x) * eased,
					y: startCenter.y +
						(targetCenter.y - startCenter.y) * eased
				},
				follow: false
			});

			this.zoomFrame = progress < 1
				? requestAnimationFrame(animate)
				: null;
		};

		this.zoomFrame = requestAnimationFrame(animate);
	}

	componentWillUnmount() {
		this.stopZoomAnimation();

		// window.removeEventListener('touchstart', this.debugTouch, true);
		// window.removeEventListener('touchmove', this.debugTouch, true);
		// if (this.touchDebug) this.touchDebug.remove();

		if (this.zoomElement && this.touchListeners) {
			Object.keys(this.touchListeners).forEach(name => {
				this.zoomElement.removeEventListener(
					name,
					this.touchListeners[name],
					true
				);
			});
		}
	}

	clickFollow() {
				this.stopZoomAnimation();
				this.routeFitActive = false;
        const { follow } = this.state;
        const newFollow = !follow;

        this.setState({
            follow: newFollow
        });

        if (newFollow) {
            const followInterval = setInterval(() => {
                if (!this.state.follow) {
                    clearInterval(followInterval);
                } else {
                    this.centerOnRider();
                }
            }, 1000);
            this.centerOnRider();
        }
    }

    centerOnRider() {
        const { followSelector } = this.props;
        const elements = document.querySelectorAll(followSelector);
        if (elements && elements.length) {
            const lastElement = elements[elements.length - 1];
            const riderRect = lastElement.getBoundingClientRect();
            const mapRect = this.zoomElement.getBoundingClientRect();

            const center = {
                x: ((riderRect.left + riderRect.width / 2) - mapRect.left) / mapRect.width,
                y: ((riderRect.top + riderRect.height / 2) - mapRect.top) / mapRect.height
            };
            this.setZoom({ center });
        }
    }

	onWheel(event) {
				this.stopZoomAnimation();
        const { scale } = this.state;
        const dir = event.deltaY < 0 ? 1 : -1;
        const newScale = scale + dir * scale * WHEEL_RATE;

        this.setZoom({ scale: newScale, follow: false });
    }

    onMouseDown(event) {
        this.start(this.fromMouseEvent(event))
        event.preventDefault();
    }
    onMouseUp(event) {
        this.end(this.fromMouseEvent(event))
        event.preventDefault();
    }
    onMouseMove(event) {
        if (this.state.dragging) {
            if (event.buttons === 0) {
                this.end();
            } else {
                this.move(this.fromMouseEvent(event))
            }
        }
        event.preventDefault();
    }

    fromMouseEvent(event) {
        return {
            points: [{ x: event.clientX, y: event.clientY }]
        };
    }

	onTouchStart(event) {
		if (event.cancelable) event.preventDefault();
		this.start(this.fromTouchEvent(event));
	}

	onTouchEnd(event) {
		const details = this.fromTouchEvent(event);

		if (details.points.length) {
			this.start(details);
		} else {
			this.end();
		}
	}

	onTouchMove(event) {
		if (event.cancelable) event.preventDefault();

		const details = this.fromTouchEvent(event);
		const previous = this.state.touchLast;

		if (!this.state.dragging || !details.points.length) {
			return;
		}

		if (
			!previous.points ||
			previous.points.length !== details.points.length
		) {
			this.start(details);
			return;
		}

		this.move(details);
	}

	onTouchCancel(event) {
		this.end();
	}

    fromTouchEvent(event) {
        const points = [];
        for(let n = 0; n < event.touches.length; n++) {
            const { clientX, clientY } = event.touches[n];
            points.push({ x: clientX, y: clientY });
        }

        return {
            points
        }
    }

	start(details) {
				this.stopZoomAnimation();
        const { clientWidth, clientHeight } = this.zoomElement;
        this.screenSize = {
            width: clientWidth,
            height: clientHeight
        }

        this.setState({
            touchStart: details,
            touchLast: details,
            dragging: true
        });
    }

    move(details) {
        const from = this.getCenter(this.state.touchLast);
        const to = this.getCenter(details);

        const { center, scale } = this.state;

        const newCenter = {
            x: center.x - (to.x - from.x),
            y: center.y - (to.y - from.y)
        };

        const newScale = from.spread && to.spread
                ? scale * (to.spread / from.spread)
                : scale;

        this.setZoom({
            center: newCenter,
            scale: newScale,
            touchLast: details,
            follow: false
        });
    }

    end(details) {
        this.setState({
            touchStart: {},
            touchLast: {},
            dragging: false
        });
    }

    getCenter(touch) {
        const { points } = touch;
        const { width, height } = this.screenSize;

        return {
            x: (points.reduce((sum, p) => (sum + p.x), 0) / points.length) / width,
            y: (points.reduce((sum, p) => (sum + p.y), 0) / points.length) / height,
            spread: this.getSpread(touch)
        }
    }

    getSpread(touch) {
        const { points } = touch;
        const { width, height } = this.screenSize;

        let maxDist = 0;
        for(let n = 0; n < points.length - 1; n++) {
            for(let m = n + 1; m < points.length; m++) {
                const p1 = points[n],
                      p2 = points[m];

                const dist = Math.sqrt( Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2) );
                maxDist = Math.max(maxDist, dist);
            }
        }
        return maxDist;
    }

	setZoom(state) {
		const { onChangeZoomLevel } = this.props;

		const center = Object.assign(
			{},
			state.center || this.state.center
		);

		let scale = state.scale || this.state.scale;

		const minimum = this.routeFitActive ? 0.1 : MIN_ZOOM;

		scale = Math.max(minimum, Math.min(MAX_ZOOM, scale));

		if (!this.routeFitActive) {
			const margin = 1 / scale / 2;

			center.x = Math.max(margin, Math.min(1 - margin, center.x));
			center.y = Math.max(margin, Math.min(1 - margin, center.y));
		}

		this.setState(Object.assign({}, state, {
			center,
			scale
		}));

		if (onChangeZoomLevel) {
			onChangeZoomLevel(scale);
		}
	}
}

export default Zoom;
