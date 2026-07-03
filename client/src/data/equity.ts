// Approximate preflop equity vs one random hand (heads-up), all 169 canonical hands.
// Used to find "nearby" distractor hands within a given equity threshold.
export const PREFLOP_EQUITY: Record<string, number> = {
  // Pocket pairs
  AA: 0.852, KK: 0.821, QQ: 0.796, JJ: 0.772, TT: 0.750,
  '99': 0.721, '88': 0.695, '77': 0.666, '66': 0.634, '55': 0.603,
  '44': 0.570, '33': 0.537, '22': 0.504,
  // Suited aces
  AKs: 0.670, AQs: 0.661, AJs: 0.654, ATs: 0.647, A9s: 0.630,
  A8s: 0.627, A7s: 0.620, A6s: 0.616, A5s: 0.615, A4s: 0.607,
  A3s: 0.602, A2s: 0.596,
  // Offsuit aces
  AKo: 0.654, AQo: 0.645, AJo: 0.636, ATo: 0.629, A9o: 0.610,
  A8o: 0.605, A7o: 0.598, A6o: 0.593, A5o: 0.591, A4o: 0.583,
  A3o: 0.579, A2o: 0.572,
  // Suited kings
  KQs: 0.634, KJs: 0.626, KTs: 0.619, K9s: 0.605, K8s: 0.594,
  K7s: 0.588, K6s: 0.583, K5s: 0.577, K4s: 0.571, K3s: 0.565, K2s: 0.559,
  // Offsuit kings
  KQo: 0.614, KJo: 0.606, KTo: 0.599, K9o: 0.583, K8o: 0.572,
  K7o: 0.565, K6o: 0.560, K5o: 0.553, K4o: 0.547, K3o: 0.541, K2o: 0.534,
  // Suited queens
  QJs: 0.603, QTs: 0.597, Q9s: 0.585, Q8s: 0.573, Q7s: 0.563,
  Q6s: 0.558, Q5s: 0.553, Q4s: 0.546, Q3s: 0.540, Q2s: 0.533,
  // Offsuit queens
  QJo: 0.582, QTo: 0.575, Q9o: 0.561, Q8o: 0.548, Q7o: 0.537,
  Q6o: 0.531, Q5o: 0.525, Q4o: 0.517, Q3o: 0.511, Q2o: 0.503,
  // Suited jacks
  JTs: 0.576, J9s: 0.566, J8s: 0.555, J7s: 0.542, J6s: 0.533,
  J5s: 0.527, J4s: 0.520, J3s: 0.514, J2s: 0.507,
  // Offsuit jacks
  JTo: 0.554, J9o: 0.543, J8o: 0.530, J7o: 0.516, J6o: 0.505,
  J5o: 0.498, J4o: 0.490, J3o: 0.483, J2o: 0.476,
  // Suited tens
  T9s: 0.554, T8s: 0.544, T7s: 0.533, T6s: 0.521, T5s: 0.511,
  T4s: 0.504, T3s: 0.498, T2s: 0.491,
  // Offsuit tens
  T9o: 0.530, T8o: 0.519, T7o: 0.507, T6o: 0.493, T5o: 0.482,
  T4o: 0.474, T3o: 0.467, T2o: 0.460,
  // Suited nines
  '98s': 0.536, '97s': 0.526, '96s': 0.515, '95s': 0.504, '94s': 0.494,
  '93s': 0.487, '92s': 0.480,
  // Offsuit nines
  '98o': 0.511, '97o': 0.500, '96o': 0.488, '95o': 0.476, '94o': 0.465,
  '93o': 0.457, '92o': 0.449,
  // Suited eights
  '87s': 0.523, '86s': 0.512, '85s': 0.501, '84s': 0.490, '83s': 0.482, '82s': 0.475,
  // Offsuit eights
  '87o': 0.496, '86o': 0.484, '85o': 0.472, '84o': 0.460, '83o': 0.451, '82o': 0.443,
  // Suited sevens
  '76s': 0.513, '75s': 0.502, '74s': 0.491, '73s': 0.482, '72s': 0.473,
  // Offsuit sevens
  '76o': 0.485, '75o': 0.473, '74o': 0.461, '73o': 0.451, '72o': 0.442,
  // Suited sixes
  '65s': 0.506, '64s': 0.495, '63s': 0.485, '62s': 0.475,
  // Offsuit sixes
  '65o': 0.476, '64o': 0.464, '63o': 0.453, '62o': 0.443,
  // Suited fives
  '54s': 0.500, '53s': 0.490, '52s': 0.480,
  // Offsuit fives
  '54o': 0.470, '53o': 0.458, '52o': 0.448,
  // Suited fours
  '43s': 0.486, '42s': 0.477,
  // Offsuit fours
  '43o': 0.455, '42o': 0.445,
  // Suited threes
  '32s': 0.473,
  // Offsuit threes
  '32o': 0.441,
};
