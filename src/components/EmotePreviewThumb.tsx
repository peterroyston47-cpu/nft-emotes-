import React from 'react';
import { CHARACTERS } from '../data/characters';
import { CharacterId, ExpressionParams } from '../types/emote';

interface EmotePreviewThumbProps {
  characterId: CharacterId;
  params: ExpressionParams;
  size?: number;
  className?: string;
}

export const EmotePreviewThumb: React.FC<EmotePreviewThumbProps> = ({
  characterId,
  params,
  className = '',
}) => {
  const uid = React.useId().replace(/:/g, '');
  const char = CHARACTERS.find((c) => c.id === characterId) || CHARACTERS[0];
  const { primaryFur, secondarySkin, innerEar, iris, studioBg } = char.palette;

  // Derive clean SVG coordinates from 16-param ExpressionParams
  const browDy = -params.browHeight * 6;
  const browRot = params.browTilt * 22;
  const eyeScaleL = Math.max(0, Math.min(1.4, params.eyeOpenL));
  const eyeScaleR = Math.max(0, Math.min(1.4, params.eyeOpenR));
  const pupilR = 3.2 * params.pupilScale;
  const gazeDx = params.gazeX * 3.2;
  const gazeDy = -params.gazeY * 2.6;
  const smileCurve = params.mouthSmile * 10;
  const mouthOpenH = params.mouthOpen * 13;
  const headTiltDeg = (params.headTiltZ * 180) / Math.PI * 0.45;
  const angerFlush = params.faceTintIntensity || 0;

  return (
    <div
      className={`relative overflow-hidden select-none ${className}`}
      style={{
        background: `radial-gradient(circle at 50% 35%, ${studioBg}ee 0%, #141C23 100%)`,
      }}
    >
      <svg
        viewBox="0 0 120 120"
        className="h-full w-full"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id={`fur-${uid}`} cx="40%" cy="30%" r="70%">
            <stop offset="0%" stopColor={primaryFur} stopOpacity="1" />
            <stop offset="100%" stopColor="#0F172A" stopOpacity="0.45" />
          </radialGradient>
          <clipPath id={`eye-socket-${uid}`}>
            <circle cx="0" cy="0" r="6.8" />
          </clipPath>
        </defs>

        {/* Subtle turntable pedestal rim at bottom */}
        <ellipse cx="60" cy="113" rx="38" ry="5.5" fill="#0F172A" opacity="0.55" />

        {/* Species Tail Silhouette */}
        {characterId === 'macaque' && (
          <path
            d="M 78 103 C 102 100, 108 78, 96 68 C 88 62, 85 72, 92 76"
            fill="none"
            stroke={primaryFur}
            strokeWidth="6"
            strokeLinecap="round"
          />
        )}
        {characterId === 'kitsune' && (
          <g>
            <path d="M 76 104 Q 108 92 102 64 Q 88 74 74 96 Z" fill={primaryFur} />
            <path d="M 102 64 Q 95 68 94 74 Q 100 72 102 64 Z" fill={innerEar} />
          </g>
        )}
        {characterId === 'tanuki' && (
          <g>
            <path d="M 76 104 Q 106 96 101 72 Q 86 78 74 98 Z" fill={primaryFur} />
            <path d="M 88 85 L 98 89 M 92 78 L 101 81" stroke={innerEar} strokeWidth="3" strokeLinecap="round" />
          </g>
        )}
        {characterId === 'axolotl' && (
          <path
            d="M 76 103 Q 106 100 105 80 Q 92 84 76 96 Z"
            fill={innerEar}
            opacity="0.85"
          />
        )}

        {/* Legs / Feet */}
        <rect x="44" y="103" width="11" height="10" rx="5" fill={primaryFur} />
        <rect x="65" y="103" width="11" height="10" rx="5" fill={primaryFur} />
        <ellipse cx="49" cy="112" rx="8" ry="4" fill={secondarySkin} />
        <ellipse cx="71" cy="112" rx="8" ry="4" fill={secondarySkin} />

        {/* Shoulders / Torso */}
        <path
          d="M 30 108 C 32 86, 88 86, 90 108 Z"
          fill={primaryFur}
        />
        <path
          d="M 45 108 C 47 91, 73 91, 75 108 Z"
          fill={secondarySkin}
          opacity="0.88"
        />

        {/* Head Group with Tilt */}
        <g transform={`translate(60, 58) rotate(${headTiltDeg.toFixed(1)})`}>
          {/* Species Ears / Gills */}
          {characterId === 'macaque' && (
            <>
              <ellipse cx="-33" cy="2" rx="9" ry="11" fill={secondarySkin} />
              <ellipse cx="-33" cy="2" rx="5" ry="7" fill={innerEar} />
              <ellipse cx="33" cy="2" rx="9" ry="11" fill={secondarySkin} />
              <ellipse cx="33" cy="2" rx="5" ry="7" fill={innerEar} />
              {/* Flame hair tuft */}
              <path d="M -8 -29 L -2 -42 L 4 -31 L 10 -38 L 12 -27 Z" fill={primaryFur} />
            </>
          )}
          {characterId === 'kitsune' && (
            <>
              <polygon points="-28,-14 -36,-46 -10,-26" fill={primaryFur} />
              <polygon points="-26,-18 -32,-39 -14,-25" fill={innerEar} />
              <polygon points="28,-14 36,-46 10,-26" fill={primaryFur} />
              <polygon points="26,-18 32,-39 14,-25" fill={innerEar} />
            </>
          )}
          {characterId === 'tanuki' && (
            <>
              <circle cx="-24" cy="-24" r="10" fill={primaryFur} />
              <circle cx="-24" cy="-24" r="5" fill={innerEar} />
              <circle cx="24" cy="-24" r="10" fill={primaryFur} />
              <circle cx="24" cy="-24" r="5" fill={innerEar} />
              {/* Sprout leaf */}
              <path d="M 0 -30 L 0 -39" stroke={innerEar} strokeWidth="2.5" />
              <ellipse cx="6" cy="-40" rx="7" ry="3.5" transform="rotate(-15 6 -40)" fill={innerEar} />
            </>
          )}
          {characterId === 'axolotl' && (
            <>
              {[-10, 0, 10].map((dy, idx) => (
                <React.Fragment key={idx}>
                  <ellipse cx="-36" cy={dy - 2} rx="9" ry="3.2" transform={`rotate(${dy * 1.4} -36 ${dy - 2})`} fill={innerEar} />
                  <ellipse cx="36" cy={dy - 2} rx="9" ry="3.2" transform={`rotate(${-dy * 1.4} 36 ${dy - 2})`} fill={innerEar} />
                </React.Fragment>
              ))}
            </>
          )}

          {/* Cranium */}
          <circle cx="0" cy="0" r="31" fill={primaryFur} />
          <circle cx="0" cy="0" r="31" fill={`url(#fur-${uid})`} opacity="0.35" />

          {/* Anger flush tint */}
          {angerFlush > 0 && (
            <circle cx="0" cy="0" r="30" fill="#E11D48" opacity={angerFlush * 0.35} />
          )}

          {/* Face Mask & Muzzle */}
          <ellipse cx="0" cy="4" rx="23" ry="20" fill={secondarySkin} />
          <ellipse
            cx="0"
            cy="14"
            rx={17 + params.cheekPuff * 4}
            ry={12 + params.cheekPuff * 2}
            fill={secondarySkin}
          />
          {angerFlush > 0 && (
            <ellipse cx="0" cy="4" rx="22" ry="19" fill="#E11D48" opacity={angerFlush * 0.28} />
          )}

          {/* Cheek Blush */}
          {params.blush > 0.05 && (
            <>
              <ellipse cx="-16" cy="9" rx="5.5" ry="3" fill="#FB7185" opacity={params.blush * 0.72} />
              <ellipse cx="16" cy="9" rx="5.5" ry="3" fill="#FB7185" opacity={params.blush * 0.72} />
            </>
          )}

          {/* Eyes */}
          {[
            { cx: -10, open: eyeScaleL },
            { cx: 10, open: eyeScaleR },
          ].map((eye, idx) => {
            const isClosed = eye.open <= 0.12;
            const lidDrop = Math.max(0, (1 - Math.min(1, eye.open)) * 8.2);
            const lowerRise = Math.max(0, (1 - Math.min(1, eye.open)) * 4.4);
            const wideBoost = eye.open > 1 ? 1 + (eye.open - 1) * 0.16 : 1;
            return (
              <g key={idx} transform={`translate(${eye.cx}, -2)`}>
                {isClosed ? (
                  <>
                    <circle cx="0" cy="0" r="6.8" fill={secondarySkin} />
                    <path
                      d={
                        params.mouthSmile > 0.35
                          ? 'M -6.2 1 Q 0 -3.2 6.2 1'
                          : 'M -6.2 0 Q 0 3.6 6.2 0'
                      }
                      fill="none"
                      stroke="#1E1B18"
                      strokeWidth="2.3"
                      strokeLinecap="round"
                    />
                  </>
                ) : (
                  <g
                    transform={`scale(1, ${wideBoost.toFixed(2)})`}
                    clipPath={`url(#eye-socket-${uid})`}
                  >
                    <circle cx="0" cy="0" r="6.8" fill="#FFFFFF" />
                    <circle cx={gazeDx} cy={gazeDy} r="4.4" fill={iris} />
                    <circle
                      cx={gazeDx}
                      cy={gazeDy}
                      r={Math.min(4, pupilR)}
                      fill="#09090B"
                    />
                    <circle
                      cx={gazeDx - 1.4}
                      cy={gazeDy - 1.5}
                      r="1.2"
                      fill="#FFFFFF"
                    />
                    {lidDrop > 0.25 && (
                      <path
                        d={`M -7.5 -7.5 L 7.5 -7.5 L 7.5 ${(-6.8 + lidDrop).toFixed(2)} Q 0 ${(-5.2 + lidDrop).toFixed(2)} -7.5 ${(-6.8 + lidDrop).toFixed(2)} Z`}
                        fill={secondarySkin}
                        stroke="#1E1B18"
                        strokeWidth="0.9"
                      />
                    )}
                    {lowerRise > 0.25 && (
                      <path
                        d={`M -7.5 7.5 L 7.5 7.5 L 7.5 ${(6.8 - lowerRise).toFixed(2)} Q 0 ${(5.6 - lowerRise).toFixed(2)} -7.5 ${(6.8 - lowerRise).toFixed(2)} Z`}
                        fill={secondarySkin}
                      />
                    )}
                  </g>
                )}
              </g>
            );
          })}

          {/* Eyebrows */}
          <g transform={`translate(-10, ${(-12 + browDy).toFixed(1)}) rotate(${(-browRot).toFixed(1)})`}>
            <rect x="-7" y="-2" width="14" height="3.8" rx="1.9" fill={angerFlush > 0.4 ? '#DC2626' : primaryFur} />
          </g>
          <g transform={`translate(10, ${(-12 + browDy).toFixed(1)}) rotate(${browRot.toFixed(1)})`}>
            <rect x="-7" y="-2" width="14" height="3.8" rx="1.9" fill={angerFlush > 0.4 ? '#DC2626' : primaryFur} />
          </g>

          {/* Nose */}
          <ellipse cx="0" cy="6" rx="4" ry="2.4" fill={innerEar} />

          {/* Mouth & Teeth */}
          {mouthOpenH > 1.8 ? (
            <g transform="translate(0, 15)">
              <path
                d={`M -11 ${(-smileCurve * 0.25).toFixed(1)} Q 0 ${(smileCurve * 0.45).toFixed(1)} 11 ${(-smileCurve * 0.25).toFixed(1)} Q 10 ${(mouthOpenH + 2).toFixed(1)} 0 ${(mouthOpenH + 3).toFixed(1)} Q -10 ${(mouthOpenH + 2).toFixed(1)} -11 ${(-smileCurve * 0.25).toFixed(1)} Z`}
                fill="#450A14"
              />
              {params.mouthSmile > 0.2 && (
                <rect x="-8" y="-1" width="16" height="3.2" rx="1.2" fill="#F8FAFC" />
              )}
              <ellipse cx="0" cy={mouthOpenH * 0.65} rx="5" ry="2.6" fill="#F43F5E" />
            </g>
          ) : (
            <path
              d={`M -10 16 Q 0 ${(16 + smileCurve * 0.7).toFixed(1)} 10 16`}
              fill="none"
              stroke="#331814"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
          )}

          {/* VFX Prop Overlays */}
          {params.vfxProp === 'hearts' && (
            <>
              <path d="M -10 -5 C -14 -9, -18 -3, -10 4 C -2 -3, -6 -9, -10 -5 Z" fill="#F43F5E" />
              <path d="M 10 -5 C 6 -9, 2 -3, 10 4 C 18 -3, 14 -9, 10 -5 Z" fill="#F43F5E" />
            </>
          )}
          {params.vfxProp === 'starEyes' && (
            <>
              <polygon points="-10,-7 -8,-3 -4,-2 -7,1 -6,5 -10,3 -14,5 -13,1 -16,-2 -12,-3" fill="#FACC15" />
              <polygon points="10,-7 12,-3 16,-2 13,1 14,5 10,3 6,5 7,1 4,-2 8,-3" fill="#FACC15" />
            </>
          )}
          {params.vfxProp === 'tears' && (
            <>
              <path d="M -14 2 Q -17 11 -13 15 Q -10 11 -14 2 Z" fill="#38BDF8" />
              <path d="M 14 2 Q 11 11 15 15 Q 18 11 14 2 Z" fill="#38BDF8" />
            </>
          )}
          {params.vfxProp === 'steam' && (
            <>
              <circle cx="-35" cy="-22" r="6" fill="#F8FAFC" opacity="0.85" />
              <circle cx="-40" cy="-29" r="4" fill="#F8FAFC" opacity="0.65" />
              <circle cx="35" cy="-22" r="6" fill="#F8FAFC" opacity="0.85" />
              <circle cx="40" cy="-29" r="4" fill="#F8FAFC" opacity="0.65" />
            </>
          )}
          {params.vfxProp === 'zzz' && (
            <text x="26" y="-26" fontSize="12" fontWeight="700" fill="#60A5FA">
              zZ
            </text>
          )}
          {params.vfxProp === 'thought' && (
            <g transform="translate(30, -34)">
              <rect x="-12" y="-8" width="24" height="14" rx="7" fill="#F8FAFC" />
              <circle cx="-5" cy="-1" r="1.6" fill="#334155" />
              <circle cx="0" cy="-1" r="1.6" fill="#334155" />
              <circle cx="5" cy="-1" r="1.6" fill="#334155" />
            </g>
          )}
          {params.vfxProp === 'sweat' && (
            <path d="M 24 -16 Q 29 -7 24 -3 Q 19 -7 24 -16 Z" fill="#38BDF8" />
          )}
          {params.vfxProp === 'halo' && (
            <ellipse cx="0" cy="-39" rx="18" ry="4.5" fill="none" stroke="#FDE047" strokeWidth="3" />
          )}
          {params.vfxProp === 'question' && (
            <text x="28" y="-25" fontSize="18" fontWeight="700" fill="#38BDF8">
              ?
            </text>
          )}
          {params.vfxProp === 'sparkles' && (
            <>
              <path d="M -34 -24 L -32 -29 L -30 -24 L -25 -22 L -30 -20 L -32 -15 L -34 -20 L -39 -22 Z" fill="#FACC15" />
              <path d="M 33 -20 L 34 -24 L 36 -20 L 40 -18 L 36 -17 L 34 -13 L 33 -17 L 29 -18 Z" fill="#FACC15" />
            </>
          )}
          {params.vfxProp === 'fire' && (
            <>
              <path d="M -32 8 Q -38 -4 -30 -12 Q -26 -2 -28 8 Z" fill="#F97316" />
              <path d="M 32 8 Q 38 -4 30 -12 Q 26 -2 28 8 Z" fill="#F97316" />
            </>
          )}
          {params.vfxProp === 'shockLines' && (
            <g stroke="#FEF08A" strokeWidth="2" strokeLinecap="round">
              <line x1="-38" y1="-26" x2="-46" y2="-32" />
              <line x1="38" y1="-26" x2="46" y2="-32" />
              <line x1="-40" y1="4" x2="-48" y2="6" />
              <line x1="40" y1="4" x2="48" y2="6" />
            </g>
          )}
        </g>

        {/* Hand Gesture Indicators */}
        {(params.handPose === 'thumbsUp' || params.handPose === 'doubleThumbs') && (
          <g>
            <circle cx="94" cy="84" r="9" fill={secondarySkin} stroke="#0F172A" strokeWidth="1.2" />
            <rect x="91" y="70" width="5" height="11" rx="2.5" fill={secondarySkin} stroke="#0F172A" strokeWidth="1" />
            {params.handPose === 'doubleThumbs' && (
              <>
                <circle cx="26" cy="84" r="9" fill={secondarySkin} stroke="#0F172A" strokeWidth="1.2" />
                <rect x="24" y="70" width="5" height="11" rx="2.5" fill={secondarySkin} stroke="#0F172A" strokeWidth="1" />
              </>
            )}
          </g>
        )}
        {params.handPose === 'wave' && (
          <g transform="translate(95, 76) rotate(12)">
            <ellipse cx="0" cy="0" rx="8" ry="10" fill={secondarySkin} stroke="#0F172A" strokeWidth="1.2" />
            <line x1="-5" y1="-8" x2="-7" y2="-16" stroke={secondarySkin} strokeWidth="3.2" strokeLinecap="round" />
            <line x1="0" y1="-9" x2="0" y2="-18" stroke={secondarySkin} strokeWidth="3.2" strokeLinecap="round" />
            <line x1="5" y1="-8" x2="7" y2="-16" stroke={secondarySkin} strokeWidth="3.2" strokeLinecap="round" />
          </g>
        )}
        {params.handPose === 'fists' && (
          <>
            <circle cx="26" cy="88" r="9.5" fill={secondarySkin} stroke="#0F172A" strokeWidth="1.4" />
            <circle cx="94" cy="88" r="9.5" fill={secondarySkin} stroke="#0F172A" strokeWidth="1.4" />
          </>
        )}
        {params.handPose === 'cheeks' && (
          <>
            <ellipse cx="32" cy="70" rx="7" ry="10" fill={secondarySkin} stroke="#0F172A" strokeWidth="1.2" />
            <ellipse cx="88" cy="70" rx="7" ry="10" fill={secondarySkin} stroke="#0F172A" strokeWidth="1.2" />
          </>
        )}
        {params.handPose === 'chinThink' && (
          <ellipse cx="64" cy="88" rx="8" ry="6" fill={secondarySkin} stroke="#0F172A" strokeWidth="1.2" />
        )}
      </svg>
    </div>
  );
};
