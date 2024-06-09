$(document).ready(function() {
    const fileInput = $('#fileInput');
    const cardContainer = $('#cardContainer');
    const downloadBtn = $('#downloadBtn');
    const resolutionSelect = $('#resolutionSelect');
    const videoElement = $('#my-video');

    const tracks = [];

    fileInput.on('change', function(e) {
        const files = e.target.files;
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const fileType = file.type;

            if (fileType.startsWith('video/')) {
                handleVideoFile(file);
            } else if (fileType.startsWith('audio/')) {
                handleAudioFile(file);
            } else if (fileType.startsWith('image/')) {
                handleImageFile(file);
            }
        }
    });

    function handleVideoFile(file) {
        const url = URL.createObjectURL(file);
        const videoElement = $('<video></video>').attr({
            src: url,
            controls: true
        });

        const card = createCard('Video', url, 'path/to/video_thumbnail.jpg');
        card.append(videoElement);
        cardContainer.append(card);

        tracks.push({ type: 'video', file });
    }

    function handleAudioFile(file) {
        const url = URL.createObjectURL(file);
        const audioElement = $('<audio></audio>').attr({
            src: url,
            controls: true
        });

        const card = createCard('Audio', url, 'path/to/audio_thumbnail.jpg');
        card.append(audioElement);
        cardContainer.append(card);

        tracks.push({ type: 'audio', file });

        generateWaveform(file, card);
    }

    function handleImageFile(file) {
        const url = URL.createObjectURL(file);
        const imgElement = $('<img>').attr('src', url);

        const card = createCard('Image', url, url);
        card.append(imgElement);
        cardContainer.append(card);

        tracks.push({ type: 'image', file });
    }

    function createCard(title, url, thumbnail) {
        const card = $('<div></div>').addClass('card').attr('draggable', true);
        const img = $('<img>').attr('src', thumbnail);
        card.append(img);
        card.on('click', function() {
            window.open(url, '_blank');
        });
        return card;
    }

    async function generateWaveform(file, card) {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const arrayBuffer = await file.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        const canvas = $('<canvas></canvas>').attr({
            width: 500,
            height: 100
        });
        const context = canvas[0].getContext('2d');

        const data = audioBuffer.getChannelData(0);
        const step = Math.ceil(data.length / canvas.width());
        const amp = canvas.height() / 2;

        context.fillStyle = 'silver';
        context.clearRect(0, 0, canvas.width(), canvas.height());

        for (let i = 0; i < canvas.width(); i++) {
            const min = Math.min(...data.slice(i * step, (i + 1) * step));
            const max = Math.max(...data.slice(i * step, (i + 1) * step));
            context.fillRect(i, (1 + min) * amp, 1, Math.max(1, (max - min) * amp));
        }

        card.append(canvas);
    }

    downloadBtn.on('click', async function() {
        try {
            const resolution = resolutionSelect.val();
            const { createFFmpeg, fetchFile } = FFmpeg;
            const ffmpeg = createFFmpeg({ log: true });
            await ffmpeg.load();

            for (const track of tracks) {
                await ffmpeg.FS('writeFile', track.file.name, await fetchFile(track.file));
            }

            const videoInputs = tracks.filter(track => track.type === 'video').map((track, index) => `[${index}:v]scale=-1:${resolution},setsar=1:1[v${index}]`).join('; ');
            const imageInputs = tracks.filter(track => track.type === 'image').map((track, index) => `[${index + tracks.filter(t => t.type === 'video').length}:v]scale=-1:${resolution},setsar=1:1[v${index + tracks.filter(t => t.type === 'video').length}]`).join('; ');
            const audioInputs = tracks.filter(track => track.type === 'audio').map((track, index) => `[${index + tracks.filter(t => t.type === 'video' || t.type === 'image').length}:a]`).join('; ');

            const filterComplex = `${videoInputs}; ${imageInputs}; ${audioInputs}`;

            const inputs = tracks.map(track => `-i ${track.file.name}`).join(' ');

            const command = `-filter_complex "${filterComplex}" -map "[v0]" -map "[a0]" output.mp4`;

            await ffmpeg.run(...inputs.split(' '), ...command.split(' '));
            const data = await ffmpeg.FS('readFile', 'output.mp4');
            const blob = new Blob([data.buffer], { type: 'video/mp4' });
            const videoUrl = URL.createObjectURL(blob);

            videoElement.attr('src', videoUrl).attr('controls', true);

            const downloadLink = $('<a></a>').attr({
                href: videoUrl,
                download: 'merged_video.mp4'
            }).text('Download');
            cardContainer.append(downloadLink);
        } catch (error) {
            console.error(error);
            alert("An error occurred while generating the video.");
        }
    });
});
