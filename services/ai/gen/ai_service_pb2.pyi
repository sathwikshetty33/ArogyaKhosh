from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from typing import ClassVar as _ClassVar, Optional as _Optional

DESCRIPTOR: _descriptor.FileDescriptor

class VerifyAccidentRequest(_message.Message):
    __slots__ = ("image", "content_type")
    IMAGE_FIELD_NUMBER: _ClassVar[int]
    CONTENT_TYPE_FIELD_NUMBER: _ClassVar[int]
    image: bytes
    content_type: str
    def __init__(self, image: _Optional[bytes] = ..., content_type: _Optional[str] = ...) -> None: ...

class VerifyAccidentResponse(_message.Message):
    __slots__ = ("confidence", "threshold", "is_accident")
    CONFIDENCE_FIELD_NUMBER: _ClassVar[int]
    THRESHOLD_FIELD_NUMBER: _ClassVar[int]
    IS_ACCIDENT_FIELD_NUMBER: _ClassVar[int]
    confidence: float
    threshold: float
    is_accident: bool
    def __init__(self, confidence: _Optional[float] = ..., threshold: _Optional[float] = ..., is_accident: _Optional[bool] = ...) -> None: ...
