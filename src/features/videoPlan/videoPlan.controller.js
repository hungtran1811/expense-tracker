import {
  addVideoTask,
  listVideoTasks,
  moveVideoTaskStage,
  updateVideoTask as updateVideoTaskDoc,
  deleteVideoTask,
  awardXp,
} from "../../services/firebase/firestore.js";
import { VIDEO_STAGES } from "./videoPlan.ui.js";

function stageIndex(stage) {
  return VIDEO_STAGES.indexOf(stage);
}

function normalizeAssetLinks(value) {
  if (Array.isArray(value)) {
    return value.map((x) => String(x || "").trim()).filter(Boolean);
  }

  return String(value || "")
    .split(/[\n,]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

export async function loadVideoTasks(uid) {
  if (!uid) return [];
  return listVideoTasks(uid, { status: "active" });
}

export async function createVideoTask(uid, payload) {
  return addVideoTask(uid, {
    title: payload.title,
    stage: payload.stage || "idea",
    priority: payload.priority || "medium",
    deadline: payload.deadline || null,
    scriptUrl: payload.scriptUrl || "",
    shotList: payload.shotList || "",
    assetLinks: normalizeAssetLinks(payload.assetLinks),
    publishChecklist: {
      titleDone: false,
      thumbnailDone: false,
      descriptionDone: false,
      tagsDone: false,
    },
    status: "active",
    note: payload.note || "",
  });
}

export async function updateVideoTaskDetails(uid, taskId, payload) {
  if (!uid || !taskId) throw new Error("Thiếu thông tin công việc video");

  const data = {
    title: payload.title,
    priority: payload.priority || "medium",
    deadline: payload.deadline || null,
    scriptUrl: payload.scriptUrl || "",
    shotList: payload.shotList || "",
    assetLinks: normalizeAssetLinks(payload.assetLinks),
    note: payload.note || "",
  };

  await updateVideoTaskDoc(uid, taskId, data);
  return true;
}

export async function moveTaskToStage(uid, task, nextStage) {
  const fromStage = task.stage || "idea";
  if (!VIDEO_STAGES.includes(nextStage) || nextStage === fromStage) return;

  await moveVideoTaskStage(uid, task.id, nextStage);

  const fromIdx = stageIndex(fromStage);
  const toIdx = stageIndex(nextStage);

  if (toIdx > fromIdx) {
    await awardXp(uid, {
      sourceType: "video",
      sourceId: task.id,
      action: "video_stage_up",
      points: 15,
      periodKey: `${task.id}_${nextStage}`,
    });
  }

  if (nextStage === "publish") {
    await awardXp(uid, {
      sourceType: "video",
      sourceId: task.id,
      action: "video_publish",
      points: 40,
      periodKey: task.id,
    });
  }
}

export async function removeVideoTask(uid, taskId) {
  return deleteVideoTask(uid, taskId);
}
