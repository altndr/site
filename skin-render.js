const GAMERTAG = window.location.pathname.split('/').filter(Boolean).pop() || "ImNdricim";

const API = `https://mcprofile.io/api/v1/bedrock/gamertag/${GAMERTAG}`;

let viewer;

fetch(API)
  .then(r => {
    if (!r.ok) throw new Error("User not found");
    return r.json();
  })
  .then(data => {
    document.getElementById("name").textContent = data.gamertag;
    document.getElementById("score").textContent = data.gamescore;
    document.getElementById("tier").textContent = data.accounttier;
    initSkin(data.skin);
  })
  .catch(err => {
    document.getElementById("name").textContent = "Player not found";
    console.error(err);
  });

function initSkin(skinUrl) {
  const canvas = document.getElementById("skin-canvas");
  const container = document.querySelector(".skin-panel");

  // Clear previous canvas if it exists (useful for switching users)
  if (viewer) {
    viewer.dispose();
  }

  viewer = new skinview3d.SkinViewer({
    canvas,
    width: container.clientWidth,
    height: container.clientHeight,
    skin: skinUrl,
    background: null,
    fov: 45
  });

  viewer.controls.enableRotate = true;
  viewer.controls.enableZoom = false;
  viewer.controls.enablePan = false;
  viewer.animation = new skinview3d.WalkingAnimation();
  viewer.camera.position.set(0, 0, 75);

window.addEventListener("resize", () => {
  // Only resize if the container is actually visible
  if (container.clientWidth > 0) {
    viewer.setSize(container.clientWidth, container.clientHeight);
  }
});
}
  const searchInput = document.getElementById("userSearch");

searchInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    const user = searchInput.value.trim();
    if (user) {
      // This will navigate to your-site.vercel.app/Username
      window.location.pathname = `/${user}`;
    }
  }
});
