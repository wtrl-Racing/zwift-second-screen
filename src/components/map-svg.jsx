import React from 'react';

const MapSVG = props => {
  const { mapSettings, defs, className = 'map-route', children, onClick } = props;
  const viewBox = props.viewBox || mapSettings.viewBox;

  return <div className={className} onClick={onClick}>
		<svg
			className="full-size"
			viewBox={viewBox}
			preserveAspectRatio={
				Number(mapSettings.worldId) === 9
					? 'none'
					: 'xMidYMid meet'
			}
		>
      {defs}
      <g transform={`rotate${mapSettings.rotate}`}>
        <g transform={`translate${mapSettings.translate}`}>
          {children}
        </g>
      </g>
    </svg>
  </div>;
};

export default MapSVG;
