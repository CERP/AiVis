from __future__ import annotations

from sqlmodel.ext.asyncio.session import AsyncSession

from app.insights.story_generator import generate_stories
from app.models.dataset import DatasetVersion
from app.models.insight import Story
from app.repositories.insight import InsightRepository, StoryRepository


async def generate_stories_for_version(
    session: AsyncSession, version: DatasetVersion
) -> list[Story]:
    insights = await InsightRepository(session).list_for_version(version.id)
    candidates = generate_stories(insights)

    story_repo = StoryRepository(session)
    saved: list[Story] = []
    for insight, candidate in zip(insights, candidates, strict=True):
        story = await story_repo.create(
            Story(
                dataset_version_id=version.id,
                insight_id=insight.id,
                title=candidate.title,
                description=candidate.description,
                analytical_question=candidate.analytical_question,
                relevant_fields=candidate.relevant_fields,
                recommended_chart_type=candidate.recommended_chart_type,
                confidence=candidate.confidence,
            )
        )
        saved.append(story)

    return saved
