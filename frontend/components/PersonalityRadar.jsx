import React from 'react';
import { motion } from 'framer-motion';

export default function PersonalityRadar({ data }) {
    // data format: { openness: 0.8, conscientiousness: 0.6, ... }
    // Normalize keys to labels
    const dimensions = [
        { key: 'openness', label: '开放性', fullLabel: 'Openness' },
        { key: 'conscientiousness', label: '尽责性', fullLabel: 'Conscientiousness' },
        { key: 'extraversion', label: '外向性', fullLabel: 'Extraversion' },
        { key: 'agreeableness', label: '宜人性', fullLabel: 'Agreeableness' },
        { key: 'neuroticism', label: '神经质', fullLabel: 'Neuroticism' }
    ];

    const size = 300;
    const center = size / 2;
    const radius = 100;
    const levels = 5;

    // Calculate points for a polygon
    const getPoints = (valueFn, scale = 1) => {
        return dimensions.map((dim, i) => {
            const angle = (Math.PI * 2 * i) / dimensions.length - Math.PI / 2;
            const value = valueFn(dim);
            const x = center + Math.cos(angle) * radius * value * scale;
            const y = center + Math.sin(angle) * radius * value * scale;
            return `${x},${y}`;
        }).join(' ');
    };

    // Background grid points
    const gridLevels = Array.from({ length: levels }).map((_, i) => {
        const scale = (i + 1) / levels;
        return getPoints(() => 1, scale);
    });

    // Data points
    const dataPoints = getPoints((dim) => data[dim.key] || 0);

    return (
        <div className="relative flex flex-col items-center justify-center">
            <svg width={size} height={size} className="overflow-visible">
                {/* Background Grid */}
                {gridLevels.map((points, i) => (
                    <polygon
                        key={i}
                        points={points}
                        fill="none"
                        stroke="rgba(6, 182, 212, 0.2)" // cyan-500/20
                        strokeWidth="1"
                        strokeDasharray={i === levels - 1 ? "0" : "4 4"}
                    />
                ))}

                {/* Axes */}
                {dimensions.map((dim, i) => {
                    const angle = (Math.PI * 2 * i) / dimensions.length - Math.PI / 2;
                    const x = center + Math.cos(angle) * radius;
                    const y = center + Math.sin(angle) * radius;
                    return (
                        <line
                            key={i}
                            x1={center}
                            y1={center}
                            x2={x}
                            y2={y}
                            stroke="rgba(6, 182, 212, 0.2)"
                            strokeWidth="1"
                        />
                    );
                })}

                {/* Data Polygon */}
                <motion.polygon
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 0.6, scale: 1 }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    points={dataPoints}
                    fill="rgba(168, 85, 247, 0.4)" // purple-500/40
                    stroke="rgba(168, 85, 247, 1)" // purple-500
                    strokeWidth="2"
                />

                {/* Data Points (Dots) */}
                {dimensions.map((dim, i) => {
                    const angle = (Math.PI * 2 * i) / dimensions.length - Math.PI / 2;
                    const value = data[dim.key] || 0;
                    const x = center + Math.cos(angle) * radius * value;
                    const y = center + Math.sin(angle) * radius * value;
                    return (
                        <motion.circle
                            key={i}
                            cx={x}
                            cy={y}
                            r="4"
                            fill="#fff"
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.5 + i * 0.1 }}
                        />
                    );
                })}

                {/* Labels */}
                {dimensions.map((dim, i) => {
                    const angle = (Math.PI * 2 * i) / dimensions.length - Math.PI / 2;
                    // Push labels out a bit further
                    const labelRadius = radius + 30;
                    const x = center + Math.cos(angle) * labelRadius;
                    const y = center + Math.sin(angle) * labelRadius;

                    return (
                        <g key={i} transform={`translate(${x}, ${y})`}>
                            <text
                                x="0"
                                y="0"
                                textAnchor="middle"
                                dominantBaseline="middle"
                                fill="rgba(255,255,255,0.8)"
                                fontSize="12"
                                className="font-mono"
                            >
                                {dim.label}
                            </text>
                            <text
                                x="0"
                                y="14"
                                textAnchor="middle"
                                dominantBaseline="middle"
                                fill="rgba(6, 182, 212, 0.6)"
                                fontSize="9"
                                className="uppercase tracking-wider"
                            >
                                {dim.fullLabel}
                            </text>
                        </g>
                    );
                })}
            </svg>
        </div>
    );
}
