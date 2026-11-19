/**
 * What to pair with an exercise in an AMRAP circuit.
 *
 * Two rules, both Ilja's (2026-11-18):
 *   1. an antagonist first — a pull wants a push, a push wants a pull;
 *   2. never two exercises that train the same primary group, so one muscle is not burnt by the whole
 *      circuit.
 *
 * The result is a ranked list of candidates for every selected exercise. It advises; it selects nothing.
 */
const AXIS_OPPOSITE = {
	push: ["pull"],
	pull: ["push"],
	squat: ["hinge", "core"],
	hinge: ["squat", "core"],
	core: ["squat", "hinge", "carry"],
	carry: ["core", "push"],
	power: ["core", "pull"],
};

const STATUS = { antagonist: 3, neutral: 2, overlap: 1, same: 0 };

function normalise(value) {
	return String(value || "").trim().toLowerCase();
}

function entryName(entry) {
	return entry && (entry.name || entry.exerciseId || entry.id) || "";
}

/**
 * @param {object[]} catalogue - the entries of data/exercise-catalogue.json
 * @param {object[]} selected - what the user already picked: `{ exerciseId }` or `{ name }`
 * @param {object} [options] - `equipment` (allowed ids), `limit` (default 3)
 * @returns {object[]} one row per selected exercise: its name and the ranked partners
 */
function suggestPairs(catalogue, selected, options = {}) {
	const entries = Array.isArray(catalogue) ? catalogue : (catalogue && catalogue.exercises) || [];
	const picked = Array.isArray(selected) ? selected : [];
	const limit = Number.isFinite(options.limit) ? Number(options.limit) : 3;
	const equipment = Array.isArray(options.equipment) ? options.equipment.map(normalise) : null;

	const byKey = new Map();
	for (const entry of entries) {
		byKey.set(normalise(entry.id), entry);
		byKey.set(normalise(entry.name), entry);
	}

	const chosen = picked
		.map((item) => byKey.get(normalise(item.exerciseId)) || byKey.get(normalise(item.name)))
		.filter(Boolean);
	const chosenIds = new Set(chosen.map((entry) => entry.id));

	const rows = picked.map((item, index) => {
		const subject = chosen[index];
		const name = subject ? subject.name : entryName(item);
		if (!subject) return { exercise: name, partners: [] };

		const subjectsPrimary = new Set(subject.primary || []);
		const wanted = AXIS_OPPOSITE[subject.movement] || [];

		const ranked = entries
			.filter((candidate) => candidate.id !== subject.id && !chosenIds.has(candidate.id))
			.filter((candidate) => !equipment || equipment.length === 0 || equipment.includes(normalise(candidate.equipment)))
			.map((candidate) => {
				const shares = (candidate.primary || []).filter((group) => subjectsPrimary.has(group));
				const axis = normalise(candidate.movement);
				let score = STATUS.neutral;
				if (axis === normalise(subject.movement)) score = STATUS.same;
				else if (wanted.includes(axis)) score = STATUS.antagonist;
				const status = shares.length ? "overlap" : (score === STATUS.antagonist ? "antagonist" : (score === STATUS.same ? "same" : "neutral"));
				return {
					name: candidate.name,
					equipment: candidate.equipment,
					movement: candidate.movement,
					status,
					shares,
					score: shares.length ? STATUS.overlap : score,
				};
			})
			// An exercise that trains a primary group the subject already trained is never suggested.
			.filter((candidate) => candidate.shares.length === 0)
			.sort((a, b) => (b.score - a.score) || a.name.localeCompare(b.name))
			.slice(0, Math.max(0, limit))
			.map(({ name: partnerName, equipment: partnerEquipment, movement, status }) => ({
				name: partnerName, equipment: partnerEquipment, movement, status,
			}));

		return { exercise: subject.name, partners: ranked };
	});

	return rows;
}

/**
 * When a chosen exercise needs equipment the user does not have, name a movement that works instead:
 * the same axis, a primary group that overlaps, and equipment that is on hand.
 */
function alternativesForMissingEquipment(catalogue, selected, availableEquipment) {
	const entries = Array.isArray(catalogue) ? catalogue : (catalogue && catalogue.exercises) || [];
	const allowed = (availableEquipment || []).map(normalise);
	return (selected || []).map((item) => {
		const wanted = normalise(item.exerciseId || item.name);
		const entry = entries.find((candidate) => normalise(candidate.id) === wanted || normalise(candidate.name) === wanted);
		if (!entry || allowed.includes(normalise(entry.equipment))) {
			return { exercise: entry ? entry.name : entryName(item), missing: false, alternatives: [] };
		}
		const alternatives = entries
			.filter((candidate) => candidate.id !== entry.id && allowed.includes(normalise(candidate.equipment)))
			.filter((candidate) => (candidate.primary || []).some((group) => (entry.primary || []).includes(group)))
			.sort((a, b) => a.name.localeCompare(b.name))
			.slice(0, 3)
			.map((candidate) => ({ name: candidate.name, equipment: candidate.equipment }));
		return { exercise: entry.name, missing: true, alternatives };
	});
}

module.exports = { suggestPairs, alternativesForMissingEquipment, AXIS_OPPOSITE };
