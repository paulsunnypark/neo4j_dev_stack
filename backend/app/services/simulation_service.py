from app.repositories.event_repository import EventRepository

class SimulationService:
    def __init__(self, event_repo: EventRepository):
        self.event_repo = event_repo

    async def set_device_status(
        self,
        project_id: str,
        device_id: str,
        status: str,
        actor: str | None = None,
    ):
        await self.event_repo.append_event(
            event_type="DeviceStatusChanged",
            payload={
                "project_id": project_id,
                "device_id": device_id,
                "status": status,
                "name": device_id,
            },
            actor=actor
        )
