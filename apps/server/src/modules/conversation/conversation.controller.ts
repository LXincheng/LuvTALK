import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Sse,
  MessageEvent,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";
import { ConversationService } from "./conversation.service";
import { StartConversationDto } from "./dto/start-conversation.dto";
import { SendMessageDto } from "./dto/send-message.dto";

@Controller("conversation")
export class ConversationController {
  constructor(private readonly conversationService: ConversationService) {}

  @Post("session")
  startSession(@Body() dto: StartConversationDto) {
    return this.conversationService.startSession(dto);
  }

  @Post(":conversationId/message")
  sendMessage(
    @Param("conversationId") conversationId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.conversationService.processMessage(conversationId, dto);
  }

  @Get(":conversationId")
  getSession(@Param("conversationId") conversationId: string) {
    return this.conversationService.getSession(conversationId);
  }

  @Sse(":conversationId/events")
  streamSession(
    @Param("conversationId") conversationId: string,
  ): Observable<MessageEvent> {
    return this.conversationService.streamSession(conversationId).pipe(
      map((session) => ({
        data: session,
      })),
    );
  }
}
