import { ItemView, WorkspaceLeaf } from "obsidian";
import type AnnotationReviewPlugin from "../main";
import { Annotation, AnnotationType } from "./types";

export const VIEW_TYPE_ANNOTATION_REVIEW = "annotation-review-view";

const TYPE_LABELS: Record<AnnotationType, string> = {
	comment: "Comment",
	delete: "Delete",
	replace: "Replace",
	insert: "Insert"
};

export class AnnotationReviewView extends ItemView {
	plugin: AnnotationReviewPlugin;

	constructor(leaf: WorkspaceLeaf, plugin: AnnotationReviewPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType() {
		return VIEW_TYPE_ANNOTATION_REVIEW;
	}

	getDisplayText() {
		return "Annotation Review";
	}

	getIcon() {
		return "check-check";
	}

	async onOpen() {
		this.render();
	}

	render() {
		const container = this.containerEl.children[1];
		container.empty();
		container.addClass("annotation-review-container");

		const annotations = this.plugin.annotations;
		if (annotations.length === 0) {
			container.createEl("div", {
				cls: "annotation-review-empty",
				text: "No annotations found in this note."
			});
			return;
		}

		for (const annotation of annotations) {
			this.renderItem(container, annotation);
		}
	}

	private renderItem(container: Element, annotation: Annotation) {
		const card = container.createEl("div", {
			cls: `annotation-review-card annotation-type-${annotation.type}`
		});

		const header = card.createEl("div", { cls: "annotation-review-header" });
		header.createEl("span", { cls: "annotation-review-badge", text: TYPE_LABELS[annotation.type] });
		if (annotation.author) {
			header.createEl("span", { cls: "annotation-review-author", text: annotation.author });
		}
		header.createEl("span", { cls: "annotation-review-line", text: `Line ${annotation.line}` });

		const body = card.createEl("div", { cls: "annotation-review-body" });
		if (annotation.type === "insert") {
			body.createEl("div", {
				cls: "annotation-review-text annotation-review-insert-text",
				text: annotation.insertedText ?? ""
			});
		} else {
			body.createEl("div", { cls: "annotation-review-text", text: annotation.originalText });
		}

		if (annotation.type === "replace" && annotation.replacement) {
			body.createEl("div", { cls: "annotation-review-replacement", text: `→ ${annotation.replacement}` });
		}

		if (annotation.commentText) {
			body.createEl("div", { cls: "annotation-review-comment", text: annotation.commentText });
		}

		card.addEventListener("click", evt => {
			if ((evt.target as HTMLElement).closest("button")) return;
			this.plugin.jumpToAnnotation(annotation);
		});

		const actions = card.createEl("div", { cls: "annotation-review-actions" });
		if (annotation.type !== "comment") {
			const approveBtn = actions.createEl("button", {
				cls: "annotation-review-approve",
				text: "Approve"
			});
			approveBtn.addEventListener("click", evt => {
				evt.stopPropagation();
				this.plugin.applyAction(annotation, "approve");
			});
		}
		const dismissBtn = actions.createEl("button", {
			cls: "annotation-review-dismiss",
			text: "Dismiss"
		});
		dismissBtn.addEventListener("click", evt => {
			evt.stopPropagation();
			this.plugin.applyAction(annotation, "dismiss");
		});
	}
}
