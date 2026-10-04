const spreadsheetCsvUrl = "https://docs.google.com/spreadsheets/d/15deoQjKWEKN-r3p0NaAI8rzMe1JpqTk7I3HRDmgeAGQ/gviz/tq?tqx=out:csv&gid=0";
const genreCatalog = [
	"Acción",
	"Comedia",
	"Drama",
	"Terror",
	"Ciencia Ficción",
	"Suspenso",
	"Romance",
	"Aventura",
	"Fantasía",
	"Animación",
	"Crimen",
	"Documental",
	"Musical",
	"Cine Independiente",
	"Western"
];
const genreByNormalizedName = new Map(genreCatalog.map((genre) => [normalizeGenre(genre), genre]));
let movieOptions = [];
let availableGenres = [];
let currentMovie = null;
let currentGenre = "";

const slotView = document.querySelector("#movie-slot");
const slotMachine = document.querySelector("#slot-machine");
const pullLeverButton = document.querySelector("#pull-lever");
const resultCard = document.querySelector("#movie-result");
const closeResultButton = document.querySelector("#close-result");
const slotStatus = document.querySelector("#slot-status");
const saveButton = document.querySelector("#save-function");
const saveStatus = document.querySelector("#save-status");
const recommendationDialog = document.querySelector("#recommendation-dialog");
const openRecommendationButton = document.querySelector("#open-recommendation-form");
const closeRecommendationButton = document.querySelector("#close-recommendation-form");
const recommendationForm = document.querySelector("#recommendation-form");
const recommendationSubmitButton = recommendationForm.querySelector("[type='submit']");
const recommendationStatus = document.querySelector("#recommendation-status");
const recommendationScriptUrl = "https://script.google.com/macros/s/AKfycbyKk7XxKP80saCi5mpYYam1rljsmoiknqvQSr74P-zM8ZtnhPg9rk_ywaSMfXULC4tR/exec";
const reelElements = [
	document.querySelector("#slot-reel-genre"),
	document.querySelector("#slot-reel-title")
];

let spinTimeout;
let reelInterval;
let lastMovieTitle = "";

function normalizeGenre(value) {
	return value
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, " ")
		.trim();
}

function parseCsv(csvText) {
	const rows = [];
	let row = [];
	let cell = "";
	let inQuotes = false;

	for (let index = 0; index < csvText.length; index += 1) {
		const character = csvText[index];
		if (character === '"') {
			if (inQuotes && csvText[index + 1] === '"') {
				cell += '"';
				index += 1;
			} else {
				inQuotes = !inQuotes;
			}
		} else if (character === "," && !inQuotes) {
			row.push(cell);
			cell = "";
		} else if ((character === "\n" || character === "\r") && !inQuotes) {
			if (character === "\r" && csvText[index + 1] === "\n") index += 1;
			row.push(cell);
			if (row.some((value) => value.trim() !== "")) rows.push(row);
			row = [];
			cell = "";
		} else {
			cell += character;
		}
	}

	row.push(cell);
	if (row.some((value) => value.trim() !== "")) rows.push(row);
	return rows;
}

function driveImageUrl(value) {
	const link = value.trim();
	if (!link) return "";

	const driveId = link.match(/\/file\/d\/([^/?#]+)/)?.[1]
		?? link.match(/[?&]id=([^&#]+)/)?.[1]
		?? link.match(/\/d\/([^/?#]+)/)?.[1];
	if (driveId) return `https://drive.google.com/thumbnail?id=${encodeURIComponent(driveId)}&sz=w1000`;
	return link;
}

function parseMovieRows(rows) {
	return rows.slice(1).flatMap((row) => {
		const values = Array.from({ length: 8 }, (_, index) => (row[index] ?? "").trim());
		const [title, rawGenres, release, duration, director, cast, synopsis, poster] = values;
		if (!title || normalizeGenre(title) === "titulo" || !rawGenres) return [];

		const genres = [...new Set(rawGenres.split("/")
			.map((value) => genreByNormalizedName.get(normalizeGenre(value.trim())))
			.filter(Boolean))];
		if (genres.length === 0) return [];

		return [{
			title,
			genres,
			release: release || "Sin dato",
			duration: duration || "Sin dato",
			director: director || "Sin dato",
			cast: cast || "Sin dato",
			synopsis: synopsis || "Sin sinopsis disponible.",
			poster: driveImageUrl(poster)
		}];
	});
}

async function loadMovieDatabase() {
	pullLeverButton.disabled = true;
	slotStatus.textContent = "Cargando películas de la cartelera...";
	try {
		const response = await fetch(spreadsheetCsvUrl);
		if (!response.ok) throw new Error(`La hoja respondió ${response.status}`);
		const csvText = await response.text();
		movieOptions = parseMovieRows(parseCsv(csvText));
		availableGenres = genreCatalog.filter((genre) => movieOptions.some((movie) => movie.genres.includes(genre)));

		if (movieOptions.length === 0 || availableGenres.length === 0) {
			throw new Error("La hoja no contiene películas con título y género válidos");
		}

		pullLeverButton.disabled = false;
		slotStatus.textContent = "";
	} catch (error) {
		movieOptions = [];
		availableGenres = [];
		slotStatus.textContent = "No se pudo cargar la cartelera. Revisa que la hoja permita acceso con el enlace.";
		console.error("No se pudo cargar la base de películas:", error);
	}
}

function chooseMovieForGenre(genre) {
	const genreMovies = movieOptions.filter((movie) => movie.genres.includes(genre));
	const availableMovies = genreMovies.filter((movie) => movie.title !== lastMovieTitle);
	const pool = availableMovies.length ? availableMovies : genreMovies;
	return pool[Math.floor(Math.random() * pool.length)];
}

function showMovie(movie, genre) {
	currentMovie = movie;
	currentGenre = genre;
	document.querySelector("#movie-title").textContent = movie.title;
	document.querySelector("#movie-genre").textContent = genre;
	document.querySelector("#movie-release").textContent = movie.release;
	document.querySelector("#movie-duration").textContent = movie.duration;
	document.querySelector("#movie-director").textContent = movie.director;
	document.querySelector("#movie-cast").textContent = movie.cast;
	document.querySelector("#movie-synopsis").textContent = movie.synopsis;
	const poster = document.querySelector("#movie-poster");
	const posterImage = document.querySelector("#movie-poster-image");
	poster.classList.remove("has-image");
	posterImage.hidden = true;
	posterImage.onload = () => {
		poster.classList.add("has-image");
		posterImage.hidden = false;
	};
	posterImage.onerror = () => {
		poster.classList.remove("has-image");
		posterImage.hidden = true;
	};
	posterImage.src = movie.poster;
	resultCard.hidden = false;
	slotStatus.textContent = "La suerte eligió tu próxima función.";
	resultCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function stopSpin() {
	window.clearTimeout(spinTimeout);
	window.clearInterval(reelInterval);
	slotMachine.classList.remove("is-spinning", "is-pulling");
	pullLeverButton.disabled = false;
}

function pullLever() {
	if (pullLeverButton.disabled) return;

	resultCard.hidden = true;
	saveStatus.textContent = "";
	pullLeverButton.disabled = true;
	slotStatus.textContent = "Girando...";
	slotMachine.classList.remove("is-pulling");
	void slotMachine.offsetWidth;
	slotMachine.classList.add("is-pulling", "is-spinning");

	reelInterval = window.setInterval(() => {
		const spinningGenre = availableGenres[Math.floor(Math.random() * availableGenres.length)];
		const genreMovies = movieOptions.filter((movie) => movie.genres.includes(spinningGenre));
		const spinningMovie = genreMovies[Math.floor(Math.random() * genreMovies.length)];
		reelElements[0].textContent = spinningGenre;
		reelElements[1].textContent = spinningMovie.title;
	}, 90);

	spinTimeout = window.setTimeout(() => {
		stopSpin();
		const genre = availableGenres[Math.floor(Math.random() * availableGenres.length)];
		const movie = chooseMovieForGenre(genre);
		lastMovieTitle = movie.title;
		reelElements[0].textContent = genre;
		reelElements[1].textContent = movie.title;
		showMovie(movie, genre);
	}, 1900);
}

function wrapText(context, text, x, y, maxWidth, lineHeight) {
	const words = text.split(" ");
	let line = "";
	let currentY = y;

	words.forEach((word) => {
		const testLine = line ? `${line} ${word}` : word;
		if (context.measureText(testLine).width > maxWidth && line) {
			context.fillText(line, x, currentY);
			line = word;
			currentY += lineHeight;
		} else {
			line = testLine;
		}
	});
	if (line) context.fillText(line, x, currentY);
	return currentY + lineHeight;
}

function drawMovieCard(movie, genre, posterBitmap) {
	const canvas = document.createElement("canvas");
	canvas.width = 1200;
	canvas.height = 1400;
	const context = canvas.getContext("2d");

	context.fillStyle = "#fffefa";
	context.fillRect(0, 0, canvas.width, canvas.height);
	context.fillStyle = "#a91f28";
	context.fillRect(0, 0, canvas.width, 20);

	context.fillStyle = "#756b5e";
	context.font = "700 25px 'Glacial Indifference', sans-serif";
	context.fillText("TICKET PARA UNO  /  TU PRÓXIMA FUNCIÓN", 72, 78);

	const posterX = 72;
	const posterY = 130;
	const posterWidth = 390;
	const posterHeight = 540;
	if (posterBitmap) {
		const scale = Math.max(posterWidth / posterBitmap.width, posterHeight / posterBitmap.height);
		const cropWidth = posterWidth / scale;
		const cropHeight = posterHeight / scale;
		context.drawImage(posterBitmap, (posterBitmap.width - cropWidth) / 2, (posterBitmap.height - cropHeight) / 2, cropWidth, cropHeight, posterX, posterY, posterWidth, posterHeight);
	} else {
		const posterGradient = context.createLinearGradient(posterX, posterY, posterX + posterWidth, posterY + posterHeight);
		posterGradient.addColorStop(0, "#293848");
		posterGradient.addColorStop(1, "#121318");
		context.fillStyle = posterGradient;
		context.fillRect(posterX, posterY, posterWidth, posterHeight);

		context.beginPath();
		context.arc(posterX + 195, posterY + 185, 62, 0, Math.PI * 2);
		context.fillStyle = "#f3c96e";
		context.fill();
		context.strokeStyle = "rgba(255, 235, 190, 0.55)";
		context.lineWidth = 3;
		context.beginPath();
		context.ellipse(posterX + 195, posterY + 205, 150, 56, -0.35, 0, Math.PI * 2);
		context.stroke();
		context.fillStyle = "#0c1015";
		context.beginPath();
		context.moveTo(posterX, posterY + 465);
		context.lineTo(posterX + 110, posterY + 320);
		context.lineTo(posterX + 220, posterY + 455);
		context.lineTo(posterX + 310, posterY + 350);
		context.lineTo(posterX + posterWidth, posterY + 490);
		context.lineTo(posterX + posterWidth, posterY + posterHeight);
		context.lineTo(posterX, posterY + posterHeight);
		context.closePath();
		context.fill();
	}

	context.textAlign = "center";
	context.fillStyle = "#fff4df";
	context.font = "700 23px 'Glacial Indifference', sans-serif";
	context.fillText("UNA PELÍCULA PARA ESTA NOCHE", posterX + posterWidth / 2, posterY + 510);
	context.textAlign = "left";

	const infoX = 520;
	const infoWidth = 610;
	context.fillStyle = "#a91f28";
	context.font = "700 22px 'Glacial Indifference', sans-serif";
	context.fillText("SELECCIÓN DEL AZAR", infoX, 160);

	context.fillStyle = "#191816";
	context.font = "700 48px 'Glacial Indifference', sans-serif";
	let y = wrapText(context, movie.title, infoX, 220, infoWidth, 56) + 12;

	const details = [
		["Género", genre],
		["Fecha de estreno", movie.release],
		["Duración", movie.duration],
		["Director", movie.director],
		["Elenco", movie.cast]
	];
	context.font = "700 22px 'Glacial Indifference', sans-serif";
	details.forEach(([label, value]) => {
		context.fillStyle = "#766d62";
		context.fillText(`${label}:`, infoX, y);
		context.fillStyle = "#302c27";
		y = wrapText(context, value, infoX + 178, y, infoWidth - 178, 29) + 10;
	});

	context.strokeStyle = "#ded6c9";
	context.lineWidth = 2;
	context.beginPath();
	context.moveTo(72, 720);
	context.lineTo(1128, 720);
	context.stroke();

	context.textAlign = "center";
	context.fillStyle = "#191816";
	context.font = "700 32px 'Glacial Indifference', sans-serif";
	context.fillText("SINOPSIS", canvas.width / 2, 775);
	context.textAlign = "left";
	context.fillStyle = "#554f48";
	context.font = "26px 'Glacial Indifference', sans-serif";
	wrapText(context, movie.synopsis, 100, 825, 1000, 41);

	context.fillStyle = "#a91f28";
	context.fillRect(72, 1270, 1056, 3);
	context.textAlign = "center";
	context.fillStyle = "#756b5e";
	context.font = "22px 'Glacial Indifference', sans-serif";
	context.fillText("TU PRÓXIMA FUNCIÓN TE ESTÁ ESPERANDO", canvas.width / 2, 1320);
	return canvas;
}

async function saveFunction() {
	const movie = currentMovie;
	if (!movie) return;

	saveButton.disabled = true;
	saveStatus.textContent = "Preparando tu imagen...";
	try {
		await document.fonts.ready;
		let posterBitmap = null;
		if (movie.poster) {
			try {
				const posterResponse = await fetch(movie.poster);
				if (posterResponse.ok) posterBitmap = await createImageBitmap(await posterResponse.blob());
			} catch {
				posterBitmap = null;
			}
		}
		const canvas = drawMovieCard(movie, currentGenre, posterBitmap);
		const blob = await new Promise((resolve, reject) => {
			canvas.toBlob((imageBlob) => imageBlob ? resolve(imageBlob) : reject(new Error("No se pudo crear la imagen")), "image/png");
		});
		const fileName = `${movie.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}.png`;
		const file = new File([blob], fileName, { type: "image/png" });

		if (navigator.canShare?.({ files: [file] })) {
			await navigator.share({ files: [file], title: movie.title });
			saveStatus.textContent = "Imagen lista para guardar en tu dispositivo.";
		} else {
			const downloadUrl = URL.createObjectURL(blob);
			const link = document.createElement("a");
			link.href = downloadUrl;
			link.download = fileName;
			link.click();
			URL.revokeObjectURL(downloadUrl);
			saveStatus.textContent = "Imagen descargada. Ya puedes guardarla en tu galería.";
		}
	} catch (error) {
		if (error.name !== "AbortError") {
			saveStatus.textContent = "No se pudo guardar la imagen. Inténtalo de nuevo.";
		}
	} finally {
		saveButton.disabled = false;
	}
}

pullLeverButton.addEventListener("click", pullLever);
closeResultButton.addEventListener("click", () => {
	window.location.reload();
});
saveButton.addEventListener("click", saveFunction);

function openRecommendationForm() {
	recommendationStatus.textContent = "";
	recommendationDialog.showModal();
	document.querySelector("#recommendation-movie-title").focus();
}

function closeRecommendationForm() {
	if (recommendationDialog.open) recommendationDialog.close();
	openRecommendationButton.focus();
}

openRecommendationButton.addEventListener("click", openRecommendationForm);
closeRecommendationButton.addEventListener("click", closeRecommendationForm);
recommendationDialog.addEventListener("cancel", (event) => {
	event.preventDefault();
});

recommendationForm.addEventListener("submit", async (event) => {
	event.preventDefault();
	if (!recommendationForm.reportValidity()) return;
	if (!recommendationScriptUrl.startsWith("https://script.google.com/macros/s/")) {
		recommendationStatus.textContent = "Falta conectar el formulario: configura la URL web de Apps Script en main.js.";
		return;
	}

	const formData = new FormData(recommendationForm);
	const recommendation = new URLSearchParams({
		title: String(formData.get("title")).trim(),
		genre: String(formData.get("genre")).trim(),
		review: String(formData.get("review")).trim(),
		contact: String(formData.get("contact")).trim()
	});

	recommendationSubmitButton.disabled = true;
	recommendationStatus.textContent = "Enviando recomendación...";
	try {
		await fetch(recommendationScriptUrl, {
			method: "POST",
			mode: "no-cors",
			body: recommendation
		});
		recommendationForm.reset();
		recommendationStatus.textContent = "Solicitud enviada. Confirma que aparezca en la hoja.";
	} catch (error) {
		recommendationStatus.textContent = "No se pudo enviar. Revisa tu conexión e inténtalo de nuevo.";
		console.error("No se pudo enviar la recomendación:", error);
	} finally {
		recommendationSubmitButton.disabled = false;
	}
});

loadMovieDatabase();
